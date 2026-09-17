<?php
/**
 * אחסון קבצי JSON שטוחים עם נעילה אטומית — במקום SQLite, כי הנפח קטן
 * (כמה מאות תלמידים/אירועים) ו-JSON קל להעתיק/לגבות ידנית.
 */

function dataPath($name) {
    global $DATA_DIR;
    return rtrim($DATA_DIR, '/').'/'.$name.'.json';
}

/** קורא קובץ JSON, מחזיר $default אם לא קיים/ריק/פגום. */
function storeRead($name, $default = []) {
    $path = dataPath($name);
    if (!file_exists($path)) return $default;
    $fh = fopen($path, 'r');
    if (!$fh) return $default;
    flock($fh, LOCK_SH);
    $raw = stream_get_contents($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $default;
}

/** כותב קובץ JSON בנעילה בלעדית וכתיבה אטומית (tmp + rename). */
function storeWrite($name, $value) {
    $path = dataPath($name);
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $tmp = $path.'.tmp.'.getmypid();
    $fh = fopen($path, 'c+');
    if (!$fh) fail('cannot open data file: '.$name, 500);
    flock($fh, LOCK_EX);
    file_put_contents($tmp, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    rename($tmp, $path);
    flock($fh, LOCK_UN);
    fclose($fh);
}

/** קורא, מפעיל $mutator על המערך, כותב בחזרה — הכל תחת נעילה בלעדית אחת (מונע race). */
function storeUpdate($name, $default, callable $mutator) {
    $path = dataPath($name);
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    if (!file_exists($path)) file_put_contents($path, json_encode($default, JSON_UNESCAPED_UNICODE));
    $fh = fopen($path, 'c+');
    flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    $data = json_decode($raw, true);
    if (!is_array($data)) $data = $default;
    $result = $mutator($data);
    $newData = is_array($result) ? $result : $data;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($newData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $newData;
}

function nextId($rows) {
    $max = 0;
    foreach ($rows as $r) { if (($r['id'] ?? 0) > $max) $max = $r['id']; }
    return $max + 1;
}
