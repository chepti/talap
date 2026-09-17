<?php
/**
 * תלפ (תיעוד לקוח פנימי) — API לאפליקציית נוכחות/משמעת כיתתית.
 *
 * אימות: כל בקשה (חוץ מ-?action=help) חייבת לשאת את המפתח,
 *        דרך header  X-Key: <מפתח>  או פרמטר  ?key=<מפתח>.
 * גופים ותשובות הם JSON. זמנים הם מחרוזות ISO 'YYYY-MM-DDTHH:MM:SS' (שעון מקומי).
 *
 * לסוכן AI: תפני ל-?action=help — זה מחזיר את כל החוזה (שדות, ערכים, דוגמאות).
 * סוכנים אמורים לקרוא ל-API הזה ישירות, לא להפעיל את ממשק הדפדפן.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Key');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require __DIR__ . '/config.php';
require __DIR__ . '/lib/store.php';

date_default_timezone_set('Asia/Jerusalem');

/* ---------- שגיאות כחריגות, כדי ש-ops ישרוד כשל בודד ---------- */
class ApiError extends Exception {
    public $status; public $extra;
    function __construct($msg, $status = 400, $extra = []) {
        parent::__construct($msg); $this->status = $status; $this->extra = $extra;
    }
}
function fail($msg, $code = 400, $extra = []) { throw new ApiError($msg, $code, $extra); }
function out($data) { echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }

const EVENT_TYPES = [
    'late'        => ['he' => 'איחור',            'color' => '#f5a623'],
    'absent'      => ['he' => 'חיסור',             'color' => '#9b59b6'],
    'positive'    => ['he' => 'חיזוק חיובי',       'color' => '#2ecc71'],
    'disturb'     => ['he' => 'הפרעה',             'color' => '#e74c3c'],
    'homework'    => ['he' => 'לא הכין שיעורי בית','color' => '#3498db'],
    'removal'     => ['he' => 'הרחקה משיעור',      'color' => '#c0392b'],
    'noEquipment' => ['he' => 'ללא ציוד',           'color' => '#7f8c8d'],
];
// אירועים שמסתיימים עם הרגע/השיעור הבודד — לא רלוונטיים לשכפול לשיעור עוקב במשוב
const NON_CARRYOVER_TYPES = ['late', 'disturb'];

const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function baseUrl() {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php');
}

/* ---------- חוזה עצמי (בלי אימות) ---------- */
function helpDoc() {
    $b = baseUrl();
    $typesDoc = [];
    foreach (EVENT_TYPES as $k => $v) $typesDoc[$k] = $v['he'];
    return [
        'name' => 'תלפ — API נוכחות כיתתית',
        'purpose' => 'תיעוד נוכחות/משמעת בכיתה, לשימוש גם ע"י האפליקציה וגם ע"י סוכן AI שמסנכרן את הנתונים למשו"ב.',
        'base_url' => $b,
        'auth' => 'header X-Key: <מפתח>  או  ?key=<מפתח>. את המפתח מקבלים מבעלת המערכת.',
        'how_to_call' => 'כל פעולה: ' . $b . '?action=<name>[&key=...] . GET לקריאה, POST עם גוף JSON לכתיבה.',
        'event_types' => $typesDoc,
        'actions' => [
            'help'            => 'GET — המסמך הזה, בלי אימות.',
            'state'           => 'GET — תמונת מצב קומפקטית: כיתות, כמה אירועים היום, כמה עדיין לא סונכרנו.',
            'classes_list'    => 'GET — כל הכיתות כולל סידור שולחנות/ישיבה.',
            'classes_upsert'  => 'POST — {id?, name, rows?, cols?}. בלי id = יצירה (ברירת מחדל 4x4 שולחנות, 2 מקומות לשולחן).',
            'classes_delete'  => 'POST — {id}.',
            'seating_update'  => 'POST — {classId, desks:[{id,row,col,seats:[studentId|null, studentId|null]}]} — מחליף את כל פריסת השולחנות/ישיבה של הכיתה.',
            'students_list'   => 'GET — ?classId=N (אופציונלי, ברירת מחדל כולם).',
            'students_upsert' => 'POST — {id?, classId, fullName, mashovMatch?, photoUrl?}. mashovMatch = חלק מהשם לחיפוש במשוב (ברירת מחדל fullName).',
            'students_delete' => 'POST — {id}.',
            'students_import' => 'POST — {classId, rows:[{fullName, mashovMatch?}, ...]} ייבוא בכמות (מאקסל/הדבקה), משבץ אוטומטית למקומות ריקים.',
            'photo_upload'    => 'POST — {studentId, imageBase64}. imageBase64 = data URL או base64 גולמי של תמונה מרובעת קטנה (JPEG). שומר ומעדכן photoUrl.',
            'schedule_list'   => 'GET — מערכת השעות השבועית הקבועה.',
            'schedule_set'    => 'POST — {entries:[{dayOfWeek(0=ראשון..6=שבת), period, startTime(HH:MM), endTime(HH:MM), classId, subject, mashovSubjectLabel?}]} — מחליף את כל המערכת.',
            'current_lesson'  => 'GET — ?classId=N&at=ISO(אופציונלי, ברירת מחדל עכשיו) — איזה שיעור (period+subject) פעיל כרגע לפי מערכת השעות.',
            'lesson_get'      => 'GET — ?classId=&date=&period= — נושא השיעור שכבר הוזן לשיעור הזה, אם יש.',
            'lesson_topic'    => 'POST — {classId, date(YYYY-MM-DD), period, topic}. שדה נושא השיעור, פעם אחת לשיעור.',
            'events_create'   => 'POST — {classId, studentId|studentMatch, type, date, period, note?}. type אחד מ-' . implode('/', array_keys(EVENT_TYPES)) . '. date+period מזהים את השיעור (ראו current_lesson).',
            'events_set_note' => 'POST — {id, note}. הוספת/עדכון הערה מילולית לאירוע קיים.',
            'events_delete'   => 'POST — {id} (ביטול סימון בטעות).',
            'events_today'    => 'GET — ?date=YYYY-MM-DD (ברירת מחדל היום) — כל האירועים+נושאי השיעור של התאריך, מקובצים לפי שיעור. זו הפעולה שמשימת הסנכרון למשו"ב קוראת.',
            'mark_synced'     => 'POST — {ids:[...]} מסמן אירועים כמוזנים במשו"ב.',
            'ops'             => 'POST — {ops:[{action,...}, ...]} — הרבה פעולות בבקשה אחת, הצלחה/כשל לכל אחת.',
        ],
        'targeting_a_student' => 'לפעולות על תלמיד/ה אפשר {"studentId":N} או {"studentMatch":"חלק מהשם"} (בתוך אותה כיתה). דו-משמעות → 409 עם candidates.',
        'examples' => [
            'רישום איחור' => 'POST ' . $b . '?action=events_create body: {"classId":1,"studentMatch":"רוני אלירז","type":"late","date":"2026-09-15","period":1}',
            'הזנת נושא שיעור' => 'POST ' . $b . '?action=lesson_topic body: {"classId":1,"date":"2026-09-15","period":1,"topic":"הובלה"}',
            'כמה פעולות יחד' => 'POST ' . $b . '?action=ops body: {"ops":[{"action":"events_create","classId":1,"studentMatch":"דנה","type":"positive","date":"2026-09-15","period":1},{"action":"events_create","classId":1,"studentMatch":"עומר","type":"late","date":"2026-09-15","period":1}]}',
        ],
        'tips' => [
            'קוראים ל-state קודם כדי ללמוד מזהי כיתות/תלמידים.',
            'עדיף studentMatch על פני id כשלא בטוחים במזהה.',
            'events_today הוא המקור לסנכרון למשו"ב — הוא כבר מקובץ לפי שיעור.',
        ],
    ];
}

$action = $_GET['action'] ?? '';
if ($action === 'help') { out(helpDoc()); }

/* ---------- שער אימות ---------- */
$key = $_SERVER['HTTP_X_KEY'] ?? $_GET['key'] ?? '';
if (!hash_equals($PASSWORD, (string)$key)) {
    http_response_code(401);
    out(['error' => 'unauthorized', 'hint' => 'שלחי header X-Key או ?key=; ראי ?action=help']);
}

function body() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/* ---------- כיתות ---------- */
function defaultDesks($rows = 4, $cols = 4) {
    $desks = [];
    $n = 1;
    for ($r = 0; $r < $rows; $r++) {
        for ($c = 0; $c < $cols; $c++) {
            $desks[] = ['id' => 'd' . $n, 'row' => $r, 'col' => $c, 'seats' => [null, null]];
            $n++;
        }
    }
    return $desks;
}

function resolveClass($classes, $data) {
    $id = (int)($data['classId'] ?? $data['id'] ?? 0);
    if ($id) {
        foreach ($classes as $c) if ($c['id'] === $id) return $c;
        fail("class #$id not found", 404);
    }
    $m = trim((string)($data['classMatch'] ?? ''));
    if ($m === '') fail('provide classId or classMatch');
    $found = array_values(array_filter($classes, function ($c) use ($m) { return mb_stripos($c['name'], $m) !== false; }));
    if (!$found) fail("no class matches \"$m\"", 404);
    if (count($found) > 1) fail("\"$m\" matches " . count($found) . " classes", 409, ['candidates' => $found]);
    return $found[0];
}

/** תלמיד לפי id או חיפוש טקסט חופשי (בתוך כיתה אם ניתנה). */
function resolveStudent($students, $data, $classId = null) {
    $id = (int)($data['studentId'] ?? 0);
    if ($id) {
        foreach ($students as $s) if ($s['id'] === $id) return $s;
        fail("student #$id not found", 404);
    }
    $m = trim((string)($data['studentMatch'] ?? ''));
    if ($m === '') fail('provide studentId or studentMatch');
    $pool = $classId ? array_values(array_filter($students, function ($s) use ($classId) { return $s['classId'] === $classId; })) : $students;
    $found = array_values(array_filter($pool, function ($s) use ($m) {
        return mb_stripos($s['fullName'], $m) !== false || mb_stripos($s['mashovMatch'] ?? '', $m) !== false;
    }));
    if (!$found) fail("no student matches \"$m\"", 404);
    if (count($found) > 1) fail("\"$m\" matches " . count($found) . " students", 409, ['candidates' => $found]);
    return $found[0];
}

/* ---------- שיעור נוכחי לפי מערכת שעות ---------- */
function findLesson($schedule, $classId, $dayOfWeek, $time) {
    foreach ($schedule as $e) {
        if ($e['classId'] == $classId && $e['dayOfWeek'] == $dayOfWeek
            && $time >= $e['startTime'] && $time < $e['endTime']) {
            return $e;
        }
    }
    return null;
}

/* ---------- dispatch: מחזיר payload, לא פולט ---------- */
function dispatch($action, $data) {
    switch ($action) {

    case 'state': {
        $classes = storeRead('classes');
        $events = storeRead('events');
        $today = date('Y-m-d');
        $todayEvents = array_values(array_filter($events, function ($e) use ($today) { return $e['date'] === $today; }));
        $unsynced = array_values(array_filter($events, function ($e) { return empty($e['syncedToMashov']); }));
        return [
            'classes' => array_map(function ($c) { return ['id' => $c['id'], 'name' => $c['name']]; }, $classes),
            'today' => $today,
            'today_events_count' => count($todayEvents),
            'unsynced_count' => count($unsynced),
            'now' => date('Y-m-d H:i:s'),
        ];
    }

    case 'classes_list':
        return ['classes' => storeRead('classes')];

    case 'classes_upsert': {
        $result = null;
        storeUpdate('classes', [], function ($classes) use ($data, &$result) {
            $id = (int)($data['id'] ?? 0);
            if ($id) {
                foreach ($classes as &$c) {
                    if ($c['id'] === $id) {
                        if (isset($data['name'])) $c['name'] = $data['name'];
                        $result = $c;
                        return $classes;
                    }
                }
                fail("class #$id not found", 404);
            }
            $name = trim($data['name'] ?? '');
            if ($name === '') fail('name required');
            $rows = (int)($data['rows'] ?? 4);
            $cols = (int)($data['cols'] ?? 4);
            $new = ['id' => nextId($classes), 'name' => $name, 'rows' => $rows, 'cols' => $cols, 'desks' => defaultDesks($rows, $cols)];
            $classes[] = $new;
            $result = $new;
            return $classes;
        });
        return ['class' => $result];
    }

    case 'classes_delete': {
        $id = (int)($data['id'] ?? 0);
        storeUpdate('classes', [], function ($classes) use ($id) {
            return array_values(array_filter($classes, function ($c) use ($id) { return $c['id'] !== $id; }));
        });
        storeUpdate('students', [], function ($students) use ($id) {
            return array_values(array_filter($students, function ($s) use ($id) { return $s['classId'] !== $id; }));
        });
        return ['deleted' => $id];
    }

    case 'seating_update': {
        $classes = storeRead('classes');
        $cls = resolveClass($classes, $data);
        $desks = $data['desks'] ?? null;
        if (!is_array($desks)) fail('desks array required');
        storeUpdate('classes', [], function ($classes) use ($cls, $desks) {
            foreach ($classes as &$c) {
                if ($c['id'] === $cls['id']) { $c['desks'] = $desks; }
            }
            return $classes;
        });
        return ['ok' => true];
    }

    case 'students_list': {
        $students = storeRead('students');
        $classId = (int)($data['classId'] ?? $_GET['classId'] ?? 0) ?: null;
        if ($classId) $students = array_values(array_filter($students, function ($s) use ($classId) { return $s['classId'] === $classId; }));
        return ['students' => $students];
    }

    case 'students_upsert': {
        $result = null;
        storeUpdate('students', [], function ($students) use ($data, &$result) {
            $id = (int)($data['id'] ?? 0);
            if ($id) {
                foreach ($students as &$s) {
                    if ($s['id'] === $id) {
                        foreach (['fullName', 'mashovMatch', 'photoUrl', 'classId'] as $f) {
                            if (array_key_exists($f, $data)) $s[$f] = $data[$f];
                        }
                        $result = $s;
                        return $students;
                    }
                }
                fail("student #$id not found", 404);
            }
            $fullName = trim($data['fullName'] ?? '');
            $classId = (int)($data['classId'] ?? 0);
            if ($fullName === '') fail('fullName required');
            if (!$classId) fail('classId required');
            $new = [
                'id' => nextId($students), 'classId' => $classId, 'fullName' => $fullName,
                'mashovMatch' => $data['mashovMatch'] ?? $fullName, 'photoUrl' => $data['photoUrl'] ?? '',
            ];
            $students[] = $new;
            $result = $new;
            return $students;
        });
        return ['student' => $result];
    }

    case 'students_delete': {
        $id = (int)($data['id'] ?? 0);
        storeUpdate('students', [], function ($students) use ($id) {
            return array_values(array_filter($students, function ($s) use ($id) { return $s['id'] !== $id; }));
        });
        return ['deleted' => $id];
    }

    case 'students_import': {
        $classId = (int)($data['classId'] ?? 0);
        if (!$classId) fail('classId required');
        $rows = $data['rows'] ?? [];
        if (!is_array($rows) || !$rows) fail('rows array required');
        $created = [];
        storeUpdate('students', [], function ($students) use ($classId, $rows, &$created) {
            foreach ($rows as $r) {
                $fullName = trim(is_array($r) ? ($r['fullName'] ?? '') : (string)$r);
                if ($fullName === '') continue;
                $new = [
                    'id' => nextId($students), 'classId' => $classId, 'fullName' => $fullName,
                    'mashovMatch' => (is_array($r) ? ($r['mashovMatch'] ?? '') : '') ?: $fullName,
                    'photoUrl' => '',
                ];
                $students[] = $new;
                $created[] = $new;
            }
            return $students;
        });
        return ['created' => $created, 'count' => count($created)];
    }

    case 'photo_upload': {
        $studentId = (int)($data['studentId'] ?? 0);
        $imageBase64 = $data['imageBase64'] ?? '';
        if (!$studentId) fail('studentId required');
        if (!$imageBase64) fail('imageBase64 required');
        if (preg_match('/^data:image\/\w+;base64,/', $imageBase64)) {
            $imageBase64 = preg_replace('/^data:image\/\w+;base64,/', '', $imageBase64);
        }
        $binary = base64_decode($imageBase64, true);
        if ($binary === false) fail('invalid base64 image data');
        if (strlen($binary) > 3 * 1024 * 1024) fail('image too large (max 3MB)', 413);

        global $DATA_DIR;
        $photosDir = dirname($DATA_DIR) . '/photos';
        if (!is_dir($photosDir)) mkdir($photosDir, 0775, true);
        $filename = 'student_' . $studentId . '.jpg';
        file_put_contents($photosDir . '/' . $filename, $binary);

        $publicPath = 'backend/photos/' . $filename . '?v=' . time();
        $result = null;
        storeUpdate('students', [], function ($students) use ($studentId, $publicPath, &$result) {
            foreach ($students as &$s) {
                if ($s['id'] === $studentId) { $s['photoUrl'] = $publicPath; $result = $s; break; }
            }
            return $students;
        });
        if (!$result) fail("student #$studentId not found", 404);
        return ['student' => $result];
    }

    case 'schedule_list':
        return ['schedule' => storeRead('schedule')];

    case 'schedule_set': {
        $entries = $data['entries'] ?? null;
        if (!is_array($entries)) fail('entries array required');
        $withIds = [];
        $n = 1;
        foreach ($entries as $e) { $e['id'] = $n++; $withIds[] = $e; }
        storeWrite('schedule', $withIds);
        return ['schedule' => $withIds];
    }

    case 'current_lesson': {
        $classId = (int)($data['classId'] ?? $_GET['classId'] ?? 0);
        if (!$classId) fail('classId required');
        $at = $data['at'] ?? ($_GET['at'] ?? date('Y-m-d\TH:i:s'));
        $ts = strtotime($at) ?: time();
        $dayOfWeek = (int)date('w', $ts);
        $time = date('H:i', $ts);
        $schedule = storeRead('schedule');
        $lesson = findLesson($schedule, $classId, $dayOfWeek, $time);
        if (!$lesson) return ['lesson' => null, 'date' => date('Y-m-d', $ts), 'dayName' => DAY_NAMES[$dayOfWeek]];
        return ['lesson' => $lesson, 'date' => date('Y-m-d', $ts), 'dayName' => DAY_NAMES[$dayOfWeek]];
    }

    case 'lesson_get': {
        $classId = (int)($data['classId'] ?? $_GET['classId'] ?? 0);
        $date = $data['date'] ?? ($_GET['date'] ?? '');
        $period = (int)($data['period'] ?? $_GET['period'] ?? 0);
        if (!$classId || !$date || !$period) fail('classId, date, period required');
        $lessons = storeRead('lessons');
        foreach ($lessons as $l) {
            if ($l['classId'] === $classId && $l['date'] === $date && $l['period'] === $period) {
                return ['lesson' => $l];
            }
        }
        return ['lesson' => null];
    }

    case 'lesson_topic': {
        $classId = (int)($data['classId'] ?? 0);
        $date = $data['date'] ?? '';
        $period = (int)($data['period'] ?? 0);
        $topic = $data['topic'] ?? '';
        if (!$classId || !$date || !$period) fail('classId, date, period required');
        $result = null;
        storeUpdate('lessons', [], function ($lessons) use ($classId, $date, $period, $topic, &$result) {
            foreach ($lessons as &$l) {
                if ($l['classId'] === $classId && $l['date'] === $date && $l['period'] === $period) {
                    $l['topic'] = $topic;
                    $l['updatedAt'] = date('Y-m-d H:i:s');
                    $result = $l;
                    return $lessons;
                }
            }
            $new = ['id' => nextId($lessons), 'classId' => $classId, 'date' => $date, 'period' => $period, 'topic' => $topic, 'updatedAt' => date('Y-m-d H:i:s')];
            $lessons[] = $new;
            $result = $new;
            return $lessons;
        });
        return ['lesson' => $result];
    }

    case 'events_create': {
        $classId = (int)($data['classId'] ?? 0);
        $type = $data['type'] ?? '';
        $date = $data['date'] ?? date('Y-m-d');
        $period = (int)($data['period'] ?? 0);
        if (!$classId) fail('classId required');
        if (!isset(EVENT_TYPES[$type])) fail('invalid type; see ?action=help');
        if (!$period) fail('period required (see ?action=current_lesson)');
        $students = storeRead('students');
        $student = resolveStudent($students, $data, $classId);
        $schedule = storeRead('schedule');
        $lesson = null;
        foreach ($schedule as $e) { if ($e['classId'] == $classId && $e['period'] == $period) { $lesson = $e; break; } }
        $result = null;
        storeUpdate('events', [], function ($events) use ($classId, $student, $type, $date, $period, $data, $lesson, &$result) {
            $new = [
                'id' => nextId($events),
                'ts' => date('Y-m-d H:i:s'),
                'classId' => $classId,
                'studentId' => $student['id'],
                'studentName' => $student['fullName'],
                'type' => $type,
                'date' => $date,
                'period' => $period,
                'subject' => $lesson['subject'] ?? '',
                'note' => $data['note'] ?? '',
                'syncedToMashov' => false,
            ];
            $events[] = $new;
            $result = $new;
            return $events;
        });
        return ['event' => $result];
    }

    case 'events_set_note': {
        $id = (int)($data['id'] ?? 0);
        $note = $data['note'] ?? '';
        if (!$id) fail('id required');
        $result = null;
        storeUpdate('events', [], function ($events) use ($id, $note, &$result) {
            foreach ($events as &$e) {
                if ($e['id'] === $id) { $e['note'] = $note; $result = $e; break; }
            }
            return $events;
        });
        if (!$result) fail("event #$id not found", 404);
        return ['event' => $result];
    }

    case 'events_delete': {
        $id = (int)($data['id'] ?? 0);
        storeUpdate('events', [], function ($events) use ($id) {
            return array_values(array_filter($events, function ($e) use ($id) { return $e['id'] !== $id; }));
        });
        return ['deleted' => $id];
    }

    case 'events_today': {
        $date = $data['date'] ?? ($_GET['date'] ?? date('Y-m-d'));
        $events = storeRead('events');
        $lessons = storeRead('lessons');
        $classes = storeRead('classes');
        $classNames = [];
        foreach ($classes as $c) $classNames[$c['id']] = $c['name'];

        $dayEvents = array_values(array_filter($events, function ($e) use ($date) { return $e['date'] === $date; }));
        $groups = []; // key: classId|period
        foreach ($dayEvents as $e) {
            $key = $e['classId'] . '|' . $e['period'];
            if (!isset($groups[$key])) {
                $topic = '';
                foreach ($lessons as $l) {
                    if ($l['classId'] === $e['classId'] && $l['date'] === $date && $l['period'] === $e['period']) { $topic = $l['topic']; break; }
                }
                $groups[$key] = [
                    'classId' => $e['classId'],
                    'className' => $classNames[$e['classId']] ?? '',
                    'period' => $e['period'],
                    'subject' => $e['subject'],
                    'topic' => $topic,
                    'events' => [],
                ];
            }
            $groups[$key]['events'][] = [
                'id' => $e['id'], 'studentId' => $e['studentId'], 'studentName' => $e['studentName'],
                'type' => $e['type'], 'typeLabel' => EVENT_TYPES[$e['type']]['he'] ?? $e['type'],
                'note' => $e['note'], 'ts' => $e['ts'], 'syncedToMashov' => $e['syncedToMashov'],
                'carryOverToNextLesson' => !in_array($e['type'], NON_CARRYOVER_TYPES, true),
            ];
        }
        ksort($groups);
        return ['date' => $date, 'lessons' => array_values($groups)];
    }

    case 'mark_synced': {
        $ids = $data['ids'] ?? [];
        if (!is_array($ids) || !$ids) fail('ids array required');
        $ids = array_map('intval', $ids);
        storeUpdate('events', [], function ($events) use ($ids) {
            foreach ($events as &$e) { if (in_array($e['id'], $ids, true)) $e['syncedToMashov'] = true; }
            return $events;
        });
        return ['marked' => $ids];
    }

    default:
        fail('unknown action: ' . $action, 404);
    }
}

/* ---------- הרצה ---------- */
try {
    if ($action === 'ops') {
        $ops = body()['ops'] ?? [];
        if (!is_array($ops) || !$ops) fail('ops array required');
        $results = [];
        foreach ($ops as $i => $op) {
            $act = $op['action'] ?? '';
            unset($op['action']);
            try {
                $results[] = ['i' => $i, 'action' => $act, 'ok' => true, 'result' => dispatch($act, $op)];
            } catch (ApiError $e) {
                $results[] = array_merge(['i' => $i, 'action' => $act, 'ok' => false, 'error' => $e->getMessage()], $e->extra);
            }
        }
        out(['results' => $results, 'now' => date('Y-m-d H:i:s')]);
    }

    out(dispatch($action, body()));

} catch (ApiError $e) {
    http_response_code($e->status);
    out(array_merge(['error' => $e->getMessage()], $e->extra));
} catch (Throwable $e) {
    http_response_code(500);
    out(['error' => 'server error', 'detail' => $e->getMessage()]);
}
