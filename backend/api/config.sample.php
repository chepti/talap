<?php
// זהו תבנית בלבד — להעתיק לקובץ בשם config.php (לא נכנס ל-git) ולמלא ערכים אמיתיים.
// cp config.sample.php config.php

// המפתח לגישה למערכת — גם כניסה למסך (UI) וגם אימות ה-API (X-Key / ?key=).
// בחרי משהו שנוח להקליד מהטאבלט פעם אחת.
$PASSWORD = 'CHANGE-ME';

// תיקיית קבצי הנתונים (JSON)
$DATA_DIR = __DIR__ . '/../data';
