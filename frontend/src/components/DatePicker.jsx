import { useEffect, useRef, useState } from 'react';
import { formatHebrewDate } from '../lib/hebrewDate';

const DOW_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']; // יום א'..יום שבת, כמקובל בלוחות שנה עבריים

function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toYmd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtGregorian(d) {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
function fmtHebrew(d) {
  try {
    return formatHebrewDate(d);
  } catch {
    return '';
  }
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = parseYmd(value);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  function openPicker() {
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
    setOpen(true);
  }

  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function pick(day) {
    onChange(toYmd(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDow = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(firstOfMonth);
  const todayYmd = toYmd(new Date());

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        className="pill-btn secondary"
        onClick={() => (open ? setOpen(false) : openPicker())}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.35, padding: '7px 16px' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
          <CalendarIcon />
          {fmtGregorian(selected)}
        </span>
        <span style={{ fontSize: '0.7rem', opacity: 0.65 }}>{fmtHebrew(selected)}</span>
      </button>

      {open && (
        <div className="card" style={{
          position: 'absolute', top: '110%', insetInlineStart: 0, zIndex: 30, width: 260,
          boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button className="pill-btn ghost" style={{ padding: '4px 12px', fontSize: '1.1rem' }} onClick={() => changeMonth(-1)}>‹</button>
            <span style={{ fontWeight: 600 }}>{monthLabel}</span>
            <button className="pill-btn ghost" style={{ padding: '4px 12px', fontSize: '1.1rem' }} onClick={() => changeMonth(1)}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, textAlign: 'center', fontSize: '0.75rem', opacity: 0.55, marginBottom: 4 }}>
            {DOW_HE.map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const cellYmd = toYmd(new Date(viewYear, viewMonth, day));
              const isSelected = cellYmd === value;
              const isToday = cellYmd === todayYmd;
              return (
                <button
                  key={i}
                  onClick={() => pick(day)}
                  style={{
                    padding: '7px 0', borderRadius: 8, fontSize: '0.85rem',
                    background: isSelected ? 'var(--color-primary)' : (isToday ? 'var(--color-primary-light)' : 'transparent'),
                    color: isSelected ? '#fff' : 'var(--color-ink)',
                    fontWeight: isToday ? 700 : 400,
                  }}
                >{day}</button>
              );
            })}
          </div>
          <button className="pill-btn ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => { onChange(todayYmd); setOpen(false); }}>היום</button>
        </div>
      )}
    </div>
  );
}
