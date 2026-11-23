# תלפ — נוכחות כיתתית

אפליקציית PWA (React + Vite) עם API ב-PHP, על `https://www.chepti.com/talap/`.

## פריסה

כל דחיפה ל-`main` (מהמחשב או מ-Claude Code בנייד) מפרסמת אוטומטית תוך כחצי דקה:
GitHub Actions בונה את ה-frontend, אורז אותו עם `backend/` ושולח ל-`deploy.php` באתר (HTTPS; Hostinger חוסם SSH מ-GitHub).

- הסוד `DEPLOY_TOKEN` בריפו חייב להתאים ל-`$DEPLOY_TOKEN` ב-`backend/api/config.php` בשרת.
- לא נוגעים ב: `backend/api/config.php`, `backend/data/*.json`, `backend/photos/*.jpg`. קבצים שהוסרו מהריפו לא נמחקים מהשרת.
- גיבוי של הקבצים שהוחלפו נשמר ב-`~/backups-private` (10 אחרונים); `deploy.php` מעדכן את עצמו אחרון.
- לפני עבודה במחשב: `git pull`, כדי לא לדרוס שינויים שהגיעו מהנייד.
- פריסה ידנית (scp) עדיין עובדת ולא מתנגשת.
