// המרת תאריך עברי לכתיב אותיות (גימטריה), למשל "י״ט באלול תשפ״ו".
// הערה: Intl.DateTimeFormat עם ca-hebrew נותן שם חודש עברי נכון, אבל אף דפדפן
// לא ממיר בפועל את היום/השנה לאותיות (nu-hebrew מתעלם בשקט וממשיך במספרים) —
// לכן ההמרה כאן ידנית. זהו כלל עיצוב גורף בפרויקט: כל תאריך עברי מוצג
// באותיות, לא במספרים.

const LETTER_VALUES = [
  [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'],
  [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'],
  [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א'],
];

function lettersForNumber(num) {
  let n = num;
  let letters = '';
  for (const [v, ch] of LETTER_VALUES) {
    if (v < 20) break;
    while (n >= v) { letters += ch; n -= v; }
  }
  // ט"ו/ט"ז במקום י"ה/י"ו, כדי לא לאיית צירוף שם קדוש
  if (n === 15) { letters += 'טו'; n = 0; }
  else if (n === 16) { letters += 'טז'; n = 0; }
  else {
    for (const [v, ch] of LETTER_VALUES) {
      if (v >= 20) continue;
      while (n >= v) { letters += ch; n -= v; }
    }
  }
  return letters;
}

/** ממיר מספר לגימטריה עברית עם גרש/גרשיים, למשל 19 -> "י״ט", 6 -> "ו׳". */
export function hebrewNumeral(num) {
  const letters = lettersForNumber(num);
  if (!letters) return '';
  if (letters.length === 1) return letters + '׳';
  return letters.slice(0, -1) + '״' + letters.slice(-1);
}

/** שנה עברית מקוצרת (בלי האלפים), למשל 5786 -> "תשפ״ו". */
export function hebrewYearShort(year) {
  return hebrewNumeral(year % 1000);
}

/** תאריך עברי מלא באותיות, למשל "י״ט באלול תשפ״ו". withYear=false משמיט את השנה. */
export function formatHebrewDate(date, { withYear = true } = {}) {
  const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
    day: 'numeric', month: 'long', year: withYear ? 'numeric' : undefined,
  }).formatToParts(date);
  return parts.map((p) => {
    if (p.type === 'day') return hebrewNumeral(Number(p.value));
    if (p.type === 'year') return hebrewYearShort(Number(p.value));
    return p.value;
  }).join('');
}
