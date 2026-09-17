import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { todayStr } from '../lib/date';
import { downloadCsv, copyTsv, lessonsToRows } from '../lib/csv';
import DatePicker from '../components/DatePicker';
import { EVENT_TYPES } from '../components/EventBucketBar';
import { formatHebrewDate } from '../lib/hebrewDate';

const COLOR_BY_TYPE = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.color]));

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function schoolYearStart() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-09-01`;
}

function CountBadge({ color, count, label }) {
  const zero = !count;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: zero ? `${color}33` : color,
        color: zero ? color : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '1rem',
      }}>{zero ? '–' : count}</div>
      <span style={{ fontSize: '0.75rem', opacity: zero ? 0.5 : 1, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

function EventDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </span>
  );
}

function LessonTable({ g }) {
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        {g.date} · {g.className} · שיעור {g.period} · {g.subject}{g.topic ? ` · ${g.topic}` : ''}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'start' }}>
            <th style={{ padding: '4px 8px' }}>תלמיד/ה</th>
            <th style={{ padding: '4px 8px' }}>אירוע</th>
            <th style={{ padding: '4px 8px' }}>הערה</th>
            <th style={{ padding: '4px 8px' }}>שעה</th>
          </tr>
        </thead>
        <tbody>
          {g.events.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '4px 8px' }}>{e.studentName}</td>
              <td style={{ padding: '4px 8px' }}><EventDot color={COLOR_BY_TYPE[e.type]} label={e.typeLabel} /></td>
              <td style={{ padding: '4px 8px', opacity: 0.8 }}>{e.note}</td>
              <td style={{ padding: '4px 8px', opacity: 0.6 }}>{e.ts?.slice(11, 16)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayLog({ classes }) {
  const [classFilter, setClassFilter] = useState('');
  const [viewDate, setViewDate] = useState(todayStr());
  const [lessons, setLessons] = useState([]);
  const [rangeFrom, setRangeFrom] = useState(schoolYearStart());
  const [rangeTo, setRangeTo] = useState(todayStr());
  const [error, setError] = useState('');

  useEffect(() => {
    api('events_today', { date: viewDate })
      .then((r) => setLessons(r.lessons))
      .catch((e) => setError(e.message));
  }, [viewDate]);

  const shown = useMemo(
    () => (classFilter ? lessons.filter((g) => g.classId === Number(classFilter)) : lessons),
    [lessons, classFilter]
  );

  async function exportRange() {
    const { lessons: rangeLessons } = await api('events_range', {
      from: rangeFrom, to: rangeTo, classId: classFilter || undefined,
    });
    downloadCsv(`תלפ_${rangeFrom}_עד_${rangeTo}.csv`, lessonsToRows(rangeLessons));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">כל הכיתות</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="pill-btn ghost" onClick={() => setViewDate((d) => addDays(d, -1))}>‹ יום קודם</button>
        <DatePicker value={viewDate} onChange={setViewDate} />
        <button className="pill-btn ghost" onClick={() => setViewDate((d) => addDays(d, 1))}>יום הבא ›</button>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
          <button className="pill-btn secondary" onClick={() => copyTsv(lessonsToRows(shown))}>העתקה</button>
          <button className="pill-btn secondary" onClick={() => downloadCsv(`תלפ_${viewDate}.csv`, lessonsToRows(shown))}>הורדת CSV</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}
      {shown.length === 0 && <div style={{ opacity: 0.6 }}>אין נתונים ליום זה{classFilter ? ' לכיתה זו' : ''}</div>}
      {shown.map((g) => <LessonTable key={`${g.classId}-${g.period}`} g={g} />)}

      <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>ייצוא טווח תאריכים:</span>
        <span>מ-</span>
        <DatePicker value={rangeFrom} onChange={setRangeFrom} />
        <span>עד</span>
        <DatePicker value={rangeTo} onChange={setRangeTo} />
        <button className="pill-btn" onClick={exportRange}>הורדת CSV לטווח</button>
      </div>
    </div>
  );
}

function StudentCard({ classes }) {
  const [classFilter, setClassFilter] = useState(classes[0]?.id ?? '');
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [from, setFrom] = useState(schoolYearStart());
  const [to, setTo] = useState(todayStr());
  const [lessons, setLessons] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!classFilter) return;
    api('students_list', { classId: classFilter }).then((r) => {
      setStudents(r.students);
      setStudentId(r.students[0]?.id ?? '');
    }).catch((e) => setError(e.message));
  }, [classFilter]);

  useEffect(() => {
    if (!studentId) { setLessons(null); return; }
    api('events_range', { from, to, studentId }).then((r) => setLessons(r.lessons)).catch((e) => setError(e.message));
  }, [studentId, from, to]);

  const allEvents = useMemo(() => {
    if (!lessons) return [];
    return lessons.flatMap((g) => g.events.map((e) => ({ ...e, date: g.date, subject: g.subject, period: g.period })))
      .sort((a, b) => b.ts.localeCompare(a.ts));
  }, [lessons]);

  const counts = useMemo(() => {
    const c = {};
    for (const e of allEvents) c[e.type] = (c[e.type] || 0) + 1;
    return c;
  }, [allEvents]);

  function rowsForExport() {
    const rows = [['תאריך', 'שיעור', 'מקצוע', 'סוג אירוע', 'הערה', 'שעה']];
    for (const e of allEvents) rows.push([e.date, e.period, e.subject, e.typeLabel, e.note || '', e.ts?.slice(11, 16)]);
    return rows;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
        <span>מ-</span>
        <DatePicker value={from} onChange={setFrom} />
        <span>עד</span>
        <DatePicker value={to} onChange={setTo} />
        <button className="pill-btn ghost" onClick={() => setFrom(schoolYearStart())}>מתחילת השנה</button>
      </div>

      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

      {lessons && (
        <>
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'center' }}>
            {EVENT_TYPES.map((t) => (
              <CountBadge key={t.key} color={t.color} count={counts[t.key] || 0} label={t.label} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pill-btn secondary" onClick={() => copyTsv(rowsForExport())}>העתקה</button>
            <button className="pill-btn secondary" onClick={() => downloadCsv(`כרטיס_תלמיד_${from}_${to}.csv`, rowsForExport())}>הורדת CSV</button>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'start' }}>
                  <th style={{ padding: '4px 8px' }}>תאריך</th>
                  <th style={{ padding: '4px 8px' }}>מקצוע</th>
                  <th style={{ padding: '4px 8px' }}>אירוע</th>
                  <th style={{ padding: '4px 8px' }}>הערה</th>
                </tr>
              </thead>
              <tbody>
                {allEvents.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '4px 8px' }}>{e.date}</td>
                    <td style={{ padding: '4px 8px' }}>{e.subject}</td>
                    <td style={{ padding: '4px 8px' }}><EventDot color={COLOR_BY_TYPE[e.type]} label={e.typeLabel} /></td>
                    <td style={{ padding: '4px 8px', opacity: 0.8 }}>{e.note}</td>
                  </tr>
                ))}
                {!allEvents.length && <tr><td colSpan={4} style={{ padding: 8, opacity: 0.6 }}>אין אירועים בטווח הזה</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function circleSize(count) {
  return 13 + Math.min(count, 6) * 3;
}

function hebrewRange(firstDate, lastDate) {
  try {
    return `${formatHebrewDate(firstDate)} – ${formatHebrewDate(lastDate)}`;
  } catch { return ''; }
}

function MonthGrid({ y, m, countsByDay, current, onPickInfo }) {
  const first = new Date(y, m, 1);
  const lastDate = new Date(y, m + 1, 0);
  const startDow = first.getDay();
  const daysInMonth = lastDate.getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthLabel = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(first);

  return (
    <div className="card" style={{ border: current ? '2px solid var(--color-primary)' : undefined }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontWeight: 700 }}>{monthLabel}</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.55 }}>{hebrewRange(first, lastDate)}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center', fontSize: '0.8rem', opacity: 0.6, margin: '8px 0 4px' }}>
        {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: 64, gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayCounts = countsByDay[dateStr] || {};
          const present = EVENT_TYPES.filter((t) => dayCounts[t.key]);
          return (
            <div key={i} style={{
              borderRadius: 10, padding: '3px 2px', overflow: 'hidden',
              background: '#fdfaf3', border: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontSize: '0.68rem', opacity: 0.5 }}>{day}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                {present.map((t) => {
                  const size = circleSize(dayCounts[t.key]);
                  return (
                    <button
                      key={t.key}
                      title={`${dateStr} · ${t.label}: ${dayCounts[t.key]}`}
                      onClick={() => onPickInfo(`${dateStr} · ${t.label}: ${dayCounts[t.key]}`)}
                      style={{
                        width: size, height: size, borderRadius: '50%', background: t.color, border: 'none', padding: 0,
                        color: '#fff', fontSize: size > 20 ? '0.65rem' : '0.55rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >{dayCounts[t.key]}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Trends({ classes }) {
  const [classFilter, setClassFilter] = useState('');
  const [students, setStudents] = useState([]);
  const [studentFilter, setStudentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [countsByMonth, setCountsByMonth] = useState({}); // "y-m" -> {date: {type: count}}
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  const months = useMemo(() => {
    const now = new Date();
    const startY = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const list = [];
    let y = startY, m = 8; // ספטמבר
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
      list.push({ y, m });
      m++; if (m > 11) { m = 0; y++; }
    }
    return list;
  }, []);

  useEffect(() => {
    setStudentFilter('');
    if (!classFilter) { setStudents([]); return; }
    api('students_list', { classId: classFilter }).then((r) => setStudents(r.students)).catch((e) => setError(e.message));
  }, [classFilter]);

  useEffect(() => {
    const from = `${months[0].y}-${String(months[0].m + 1).padStart(2, '0')}-01`;
    const lastM = months[months.length - 1];
    const lastDay = new Date(lastM.y, lastM.m + 1, 0).getDate();
    const to = `${lastM.y}-${String(lastM.m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    api('events_range', { from, to, classId: classFilter || undefined, studentId: studentFilter || undefined })
      .then((r) => {
        const byMonth = {};
        for (const g of r.lessons) {
          for (const e of g.events) {
            if (typeFilter && e.type !== typeFilter) continue;
            const [y, m] = g.date.split('-');
            const key = `${Number(y)}-${Number(m) - 1}`;
            if (!byMonth[key]) byMonth[key] = {};
            if (!byMonth[key][g.date]) byMonth[key][g.date] = {};
            byMonth[key][g.date][e.type] = (byMonth[key][g.date][e.type] || 0) + 1;
          }
        }
        setCountsByMonth(byMonth);
      })
      .catch((e) => setError(e.message));
  }, [classFilter, studentFilter, typeFilter, months]);

  const now = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">כל הכיתות</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} disabled={!classFilter}>
          <option value="">כל התלמידים</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">כל סוגי האירועים</option>
          {EVENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

      {info && <div className="card" style={{ fontWeight: 600, textAlign: 'center' }}>{info}</div>}

      <div
        ref={(el) => { if (el && !el.dataset.scrolled) { el.scrollTop = el.scrollHeight; el.dataset.scrolled = '1'; } }}
        style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto', padding: 2 }}
      >
        <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>↑ חודשים קודמים למעלה, לגלול להשוואה</div>
        {months.map(({ y, m }) => (
          <MonthGrid
            key={`${y}-${m}`} y={y} m={m}
            countsByDay={countsByMonth[`${y}-${m}`] || {}}
            current={y === now.getFullYear() && m === now.getMonth()}
            onPickInfo={setInfo}
          />
        ))}
      </div>
      <div style={{ opacity: 0.6, fontSize: '0.85rem' }}>כל עיגול הוא סוג אירוע — הגודל גדל לפי כמות האירועים מאותו סוג באותו יום. לחיצה על עיגול מציגה פירוט למעלה.</div>
    </div>
  );
}

export default function ReportsView({ onBack }) {
  const [tab, setTab] = useState('day');
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('classes_list').then((r) => setClasses(r.classes)).catch((e) => setError(e.message));
  }, []);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="pill-btn ghost" onClick={onBack}>← חזרה</button>
        <h1 style={{ margin: 0 }}>דוחות</h1>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className={`pill-btn ${tab === 'day' ? '' : 'secondary'}`} onClick={() => setTab('day')}>יומן שיעורים</button>
        <button className={`pill-btn ${tab === 'student' ? '' : 'secondary'}`} onClick={() => setTab('student')}>כרטיס תלמיד</button>
        <button className={`pill-btn ${tab === 'trends' ? '' : 'secondary'}`} onClick={() => setTab('trends')}>מגמות</button>
      </div>

      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

      {classes.length > 0 && tab === 'day' && <DayLog classes={classes} />}
      {classes.length > 0 && tab === 'student' && <StudentCard classes={classes} />}
      {classes.length > 0 && tab === 'trends' && <Trends classes={classes} />}
    </div>
  );
}
