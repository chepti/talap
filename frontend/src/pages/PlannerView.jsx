import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { todayStr } from '../lib/date';
import { formatHebrewDate } from '../lib/hebrewDate';

const pad = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return toYmd(d); };

// ברירת מחדל: השבוע הקרוב להכנה — ביום שישי/שבת מציגים את השבוע הבא (שבוע מתחיל ביום ראשון)
function defaultWeekStart() {
  const d = parseYmd(todayStr());
  const dow = d.getDay();
  d.setDate(d.getDate() - dow + (dow >= 5 ? 7 : 0));
  return toYmd(d);
}

// קישור שהוקלד בלי פרוטוקול (docs.google.com/...) מקבל https:// אוטומטית
function normalizeUrl(v) {
  const t = v.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function PlanCard({ entry, className, date, lesson }) {
  const [topic, setTopic] = useState(lesson?.topic || '');
  const [planUrl, setPlanUrl] = useState(lesson?.planUrl || '');
  const [notes, setNotes] = useState(lesson?.notes || '');
  const [saved, setSaved] = useState(false);

  async function save(field, value) {
    await api('lesson_topic', { classId: entry.classId, date, period: entry.period, [field]: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const filled = topic.trim() || planUrl.trim() || notes.trim();
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, background: filled ? 'var(--color-primary-light)' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b>{className}</b>
        <span style={{ opacity: 0.7 }}>שיעור {entry.period} · {entry.subject}</span>
        <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>{entry.startTime}–{entry.endTime}</span>
        {saved && <span style={{ marginInlineStart: 'auto', color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 600 }}>נשמר</span>}
      </div>
      <input
        type="text" placeholder="נושא השיעור" value={topic}
        onChange={(e) => setTopic(e.target.value)} onBlur={() => save('topic', topic)}
      />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text" inputMode="url" placeholder="קישור לתכנון השיעור / מצגת הרצף" value={planUrl} dir="ltr"
          onChange={(e) => setPlanUrl(e.target.value)}
          onBlur={() => { const u = normalizeUrl(planUrl); setPlanUrl(u); save('planUrl', u); }}
          style={{ flex: 1, textAlign: 'start' }}
        />
        {/^https?:\/\//i.test(planUrl) && (
          <a href={planUrl} target="_blank" rel="noopener noreferrer" className="pill-btn secondary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}>
            <LinkIcon />פתיחה
          </a>
        )}
      </div>
      <textarea
        rows={2} placeholder="הערות לעצמי: מה להדפיס, להכין, להביא…" value={notes}
        onChange={(e) => setNotes(e.target.value)} onBlur={() => save('notes', notes)}
      />
    </div>
  );
}

export default function PlannerView({ onBack }) {
  const [weekStart, setWeekStart] = useState(defaultWeekStart());
  const [classes, setClasses] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [lessons, setLessons] = useState(null);
  const [classFilter, setClassFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('classes_list'), api('schedule_list')])
      .then(([c, s]) => { setClasses(c.classes); setSchedule(s.schedule); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setLessons(null);
    api('lessons_range', { from: weekStart, to: addDays(weekStart, 6) })
      .then((r) => setLessons(r.lessons))
      .catch((e) => setError(e.message));
  }, [weekStart]);

  const classNames = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);

  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 6; i++) { // ראשון עד שישי
      const date = addDays(weekStart, i);
      const entries = schedule
        .filter((e) => e.dayOfWeek === i && e.subject?.trim() !== 'תפילה' && (!classFilter || e.classId === Number(classFilter)))
        .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.period - b.period);
      if (entries.length) out.push({ date, entries });
    }
    return out;
  }, [weekStart, schedule, classFilter]);

  const lessonOf = (classId, date, period) => lessons?.find((l) => l.classId === classId && l.date === date && l.period === period);
  const rangeLabel = `${formatHebrewDate(parseYmd(weekStart), { withYear: false })} – ${formatHebrewDate(parseYmd(addDays(weekStart, 5)), { withYear: false })}`;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="pill-btn ghost" onClick={onBack}>← חזרה</button>
        <h1 style={{ margin: 0 }}>תכנון שיעורים</h1>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="pill-btn ghost" onClick={() => setWeekStart((w) => addDays(w, -7))}>‹ שבוע קודם</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>שבוע {weekStart.split('-').reverse().join('.')}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{rangeLabel}</div>
        </div>
        <button className="pill-btn ghost" onClick={() => setWeekStart((w) => addDays(w, 7))}>שבוע הבא ›</button>
        <button className="pill-btn secondary" onClick={() => setWeekStart(defaultWeekStart())}>השבוע הקרוב</button>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ marginInlineStart: 'auto' }}>
          <option value="">כל הכיתות</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}
      {lessons && days.length === 0 && <div style={{ opacity: 0.6 }}>אין שיעורים במערכת השעות לשבוע הזה (שיעורי תפילה לא מוצגים).</div>}

      {lessons && days.map(({ date, entries }) => (
        <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 700, marginTop: 6 }}>
            {new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseYmd(date))}
            <span style={{ fontWeight: 400, opacity: 0.6, marginInlineStart: 8 }}>{formatHebrewDate(parseYmd(date), { withYear: false })}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {entries.map((e) => (
              <PlanCard
                key={`${date}-${e.classId}-${e.period}`}
                entry={e} className={classNames[e.classId] || ''} date={date}
                lesson={lessonOf(e.classId, date, e.period)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
