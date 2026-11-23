<?php
/**
 * נקודת פריסה של תלפ. GitHub Actions בונה את האפליקציה (Vite), אורז zip (frontend/dist + backend) ושולח אליה ב-HTTPS
 * (Hostinger חוסם SSH מכתובות של GitHub Actions, אבל HTTPS לאתר עצמו עובד).
 *
 * POST deploy.php   כותרת X-Deploy-Token: <$DEPLOY_TOKEN מתוך backend/api/config.php>
 *                   גוף multipart: bundle=<zip>  (+ sha=<קומיט>, לדיווח בלבד)
 *
 * מעתיק רק קבצים שהשתנו (md5), שומר גיבוי של מה שיוחלף ב-~/backups-private (10 אחרונים), נועל נגד ריצה כפולה.
 * לעולם לא נוגע ב: backend/api/config.php, backend/data/*.json, backend/photos/*.jpg. לא מוחק קבצים.
 */
header('Content-Type: application/json; charset=utf-8');

function reply($code, $arr) { http_response_code($code); echo json_encode($arr, JSON_UNESCAPED_UNICODE); exit; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reply(405, ['error' => 'POST only']);

require __DIR__ . '/backend/api/config.php';
if (empty($DEPLOY_TOKEN) || strlen($DEPLOY_TOKEN) < 24) reply(503, ['error' => 'deploy not configured']);
$given = $_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '';
if (!is_string($given) || !hash_equals($DEPLOY_TOKEN, $given)) { usleep(400000); reply(401, ['error' => 'unauthorized']); }

$up = $_FILES['bundle'] ?? null;
if (!$up || ($up['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($up['tmp_name'])) reply(400, ['error' => 'bundle upload missing or failed']);

$lock = fopen(sys_get_temp_dir() . '/talap-deploy.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) reply(409, ['error' => 'deploy already running']);

set_time_limit(120);
$zip = new ZipArchive();
if ($zip->open($up['tmp_name']) !== true) reply(400, ['error' => 'bundle is not a valid zip']);

$root = __DIR__;
$skip = function ($rel) {
    return $rel === '' || $rel[0] === '/' || strpos($rel, '..') !== false
        || $rel === 'backend/api/config.php'
        || preg_match('#^backend/data/.*\.json$#', $rel)
        || preg_match('#^backend/photos/.*\.jpe?g$#', $rel)
        || preg_match('#(^|/)\.git(/|$)#', $rel);
};

$same = 0; $skipped = 0; $plan = []; $selfUpdate = null;
for ($i = 0; $i < $zip->numFiles; $i++) {
    $rel = $zip->getNameIndex($i);
    if (substr($rel, -1) === '/') continue;
    if ($skip($rel)) { $skipped++; continue; }
    $data = $zip->getFromIndex($i);
    if ($data === false) continue;
    $dest = $root . '/' . $rel;
    if (is_file($dest) && md5_file($dest) === md5($data)) { $same++; continue; }
    if ($rel === 'deploy.php') { $selfUpdate = [$rel, $dest, $data]; continue; }   // נכתב אחרון
    $plan[] = [$rel, $dest, $data];
}
if ($selfUpdate) $plan[] = $selfUpdate;

$backupDir = null;
foreach ([getenv('HOME'), dirname($root, 4), dirname($root, 3)] as $h) {
    if ($h && is_dir($h . '/backups-private')) { $backupDir = $h . '/backups-private'; break; }
}
if (!$backupDir) {
    $h = dirname($root, 4);
    if ($h && is_dir($h) && @mkdir($h . '/backups-private', 0700)) $backupDir = $h . '/backups-private';
}
$backupFile = null;
if ($plan && $backupDir) {
    $backupFile = $backupDir . '/talap-predeploy-' . date('Ymd-His') . '.zip';
    $bz = new ZipArchive();
    if ($bz->open($backupFile, ZipArchive::CREATE) === true) {
        foreach ($plan as [$rel, $dest]) if (is_file($dest)) $bz->addFile($dest, $rel);
        $bz->close();
    } else { $backupFile = null; }
    $old = glob($backupDir . '/talap-predeploy-*.zip'); sort($old);
    foreach (array_slice($old, 0, max(0, count($old) - 10)) as $f) @unlink($f);
}

$changed = [];
foreach ($plan as [$rel, $dest, $data]) {
    $dir = dirname($dest);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) reply(500, ['error' => "mkdir failed: $rel", 'changed' => $changed]);
    $tmp = $dest . '.deploytmp';
    if (file_put_contents($tmp, $data) === false || !rename($tmp, $dest)) {
        @unlink($tmp);
        reply(500, ['error' => "write failed: $rel", 'changed' => $changed, 'backup' => $backupFile ? basename($backupFile) : null]);
    }
    $changed[] = $rel;
}
$zip->close();

$sha = preg_match('/^[0-9a-f]{40}$/', (string)($_POST['sha'] ?? '')) ? $_POST['sha'] : null;
if ($backupDir) @file_put_contents($backupDir . '/talap-last-deploy.json', json_encode(['at' => date('c'), 'sha' => $sha, 'changed' => $changed], JSON_UNESCAPED_UNICODE));
reply(200, ['ok' => true, 'sha' => $sha, 'changed' => $changed, 'unchanged' => $same, 'skipped_protected' => $skipped,
            'backup' => $backupFile ? basename($backupFile) : null]);
