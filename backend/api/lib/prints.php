<?php
/* ---------- הדפסות: קבצים להדפסה לכל שיעור + מייל מרוכז ---------- */

function sanitizePrints($arr) {
    if (!is_array($arr)) return [];
    $out = [];
    foreach (array_slice($arr, 0, 20) as $p) {
        if (!is_array($p)) continue;
        $title = mb_substr(trim((string)($p['title'] ?? '')), 0, 150);
        $url = mb_substr(trim((string)($p['url'] ?? '')), 0, 500);
        if ($url !== '' && !preg_match('#^https?://#i', $url)) $url = 'https://' . $url;
        if ($title === '' && $url === '') continue;
        $out[] = [
            'title'  => $title !== '' ? $title : $url,
            'url'    => $url,
            'copies' => max(1, min(999, (int)($p['copies'] ?? 1))),
            'pages'  => max(0, min(999, (int)($p['pages'] ?? 0))),
            'note'   => mb_substr(trim((string)($p['note'] ?? '')), 0, 200),
        ];
    }
    return $out;
}

function printSettings() {
    $s = storeRead('print_settings', []);
    return array_merge(['enabled' => false, 'dayOfWeek' => 1, 'hour' => 18, 'recipients' => [], 'lastSentDate' => ''], $s);
}

/** בונה את תוכן המייל לחלון [from, to] (תאריכים Y-m-d). */
function buildPrintDigest($from, $to) {
    $classes = [];
    foreach (storeRead('classes') as $c) $classes[$c['id']] = $c['name'];
    $subjects = [];
    foreach (storeRead('schedule') as $e) $subjects[$e['classId'] . '|' . $e['period']] = $e['subject'] ?? '';
    $rows = [];
    foreach (storeRead('lessons') as $l) {
        if ($l['date'] < $from || $l['date'] > $to || empty($l['prints'])) continue;
        $rows[] = $l;
    }
    usort($rows, function ($a, $b) { return strcmp($a['date'], $b['date']) ?: ($a['period'] <=> $b['period']); });
    $e = function ($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); };
    $totalDocs = 0; $totalSheets = 0; $items = []; $body = '';
    foreach ($rows as $l) {
        $ts = strtotime($l['date']);
        $cname = $classes[$l['classId']] ?? ('כיתה ' . $l['classId']);
        $subj = $subjects[$l['classId'] . '|' . $l['period']] ?? '';
        $head = DAY_NAMES[(int)date('w', $ts)] . ' ' . date('d.m', $ts) . ' · ' . $cname . ($subj ? ' · ' . $subj : '') . ' · שיעור ' . $l['period'];
        $body .= '<h3 style="margin:22px 0 4px;font-size:16px;color:#1f5f45">' . $e($head) . '</h3>';
        if (!empty($l['topic'])) $body .= '<div style="color:#666;margin-bottom:6px">נושא: ' . $e($l['topic']) . '</div>';
        $body .= '<table style="border-collapse:collapse;width:100%;font-size:14px"><tr style="background:#eef5f0">'
               . '<th style="text-align:right;padding:6px 8px">קובץ</th><th style="padding:6px 8px">עותקים</th><th style="padding:6px 8px">עמודים</th>'
               . '<th style="padding:6px 8px">סה"כ דפים</th><th style="text-align:right;padding:6px 8px">הערה</th></tr>';
        foreach ($l['prints'] as $p) {
            $sheets = $p['copies'] * $p['pages'];
            $totalDocs++; $totalSheets += $sheets;
            $name = $p['url'] ? '<a href="' . $e($p['url']) . '" style="color:#1a6fb5">' . $e($p['title']) . '</a>' : $e($p['title']);
            $body .= '<tr style="border-bottom:1px solid #e3e3e3"><td style="padding:6px 8px">' . $name . '</td>'
                   . '<td style="text-align:center;padding:6px 8px;font-weight:bold">' . $p['copies'] . '</td>'
                   . '<td style="text-align:center;padding:6px 8px">' . ($p['pages'] ?: '—') . '</td>'
                   . '<td style="text-align:center;padding:6px 8px">' . ($p['pages'] ? $sheets : '—') . '</td>'
                   . '<td style="padding:6px 8px;color:#555">' . $e($p['note']) . '</td></tr>';
            $items[] = ['date' => $l['date'], 'class' => $cname, 'period' => $l['period'], 'title' => $p['title'], 'url' => $p['url'],
                        'copies' => $p['copies'], 'pages' => $p['pages'], 'note' => $p['note']];
        }
        $body .= '</table>';
    }
    $range = date('d.m', strtotime($from)) . '–' . date('d.m', strtotime($to));
    $subject = "הדפסות לשבוע ($range): $totalDocs קבצים, $totalSheets דפים";
    $html = '<div dir="rtl" style="font-family:Arial,Heebo,sans-serif;max-width:720px;margin:auto;color:#222;line-height:1.5">'
          . '<h2 style="margin:0 0 4px">הדפסות לשבוע הקרוב</h2><div style="color:#666">' . $e($range) . ' · ' . $totalDocs . ' קבצים · '
          . $totalSheets . ' דפים בסך הכול (עותקים × עמודים)</div>'
          . $body . '<p style="color:#999;font-size:12px;margin-top:28px">נשלח אוטומטית מתלפ (chepti.com/talap)</p></div>';
    return ['count' => $totalDocs, 'sheets' => $totalSheets, 'subject' => $subject, 'html' => $html, 'items' => $items, 'from' => $from, 'to' => $to];
}

function sendDigestMail($to, $subject, $html) {
    $sub = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n"
             . 'From: =?UTF-8?B?' . base64_encode('תלפ') . "?= <noreply@chepti.com>\r\n";
    return @mail($to, $sub, chunk_split(base64_encode($html)), $headers);
}

/** $force=true: שולח עכשיו בלי לבדוק יום/שעה. אחרת — רק אם הגיע הזמן שהוגדר ועדיין לא נשלח היום. */
function runPrintDigest($force) {
    $s = printSettings();
    $today = date('Y-m-d');
    $from = date('Y-m-d', strtotime('+1 day'));
    $to = date('Y-m-d', strtotime('+7 days'));
    if (!$force) {
        if (!$s['enabled'] || !$s['recipients']) return ['sent' => false, 'reason' => 'disabled or no recipients'];
        if ((int)date('w') !== (int)$s['dayOfWeek']) return ['sent' => false, 'reason' => 'not the scheduled day'];
        if ((int)date('G') < (int)$s['hour']) return ['sent' => false, 'reason' => 'before scheduled hour'];
        if ($s['lastSentDate'] === $today) return ['sent' => false, 'reason' => 'already handled today'];
    }
    if (!$s['recipients']) fail('אין נמענים מוגדרים — הגדירי כתובת מייל בהגדרות ההדפסות');
    $d = buildPrintDigest($from, $to);
    if ($d['count'] === 0) {
        if (!$force) { $s['lastSentDate'] = $today; storeWrite('print_settings', $s); }
        return ['sent' => false, 'reason' => 'nothing to print', 'from' => $from, 'to' => $to];
    }
    $ok = true; $failed = [];
    foreach ($s['recipients'] as $rcpt) {
        if (!sendDigestMail($rcpt, $d['subject'], $d['html'])) { $ok = false; $failed[] = $rcpt; }
    }
    if ($ok && !$force) { $s['lastSentDate'] = $today; storeWrite('print_settings', $s); }
    return ['sent' => $ok, 'failed' => $failed, 'recipients' => $s['recipients'], 'count' => $d['count'], 'sheets' => $d['sheets'],
            'subject' => $d['subject'], 'from' => $from, 'to' => $to];
}
