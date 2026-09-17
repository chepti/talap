function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function downloadCsv(filename, rows) {
  const content = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyTsv(rows) {
  const text = rows.map((r) => r.map((v) => String(v ?? '')).join('\t')).join('\n');
  await navigator.clipboard.writeText(text);
}

// שורות טבלה משטח קבוצות שיעורים (כמו שמוחזר מ-events_today / events_range) לרשימת שורות פשוטה
export function lessonsToRows(lessonGroups) {
  const rows = [['תאריך', 'כיתה', 'שיעור', 'מקצוע', 'נושא', 'תלמיד', 'סוג אירוע', 'הערה', 'שעה']];
  for (const g of lessonGroups) {
    for (const e of g.events) {
      rows.push([g.date || '', g.className, g.period, g.subject, g.topic || '', e.studentName, e.typeLabel, e.note || '', e.ts]);
    }
  }
  return rows;
}
