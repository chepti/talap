import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function ScheduleAdmin({ onBack }) {
  const [classes, setClasses] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ classes }, { schedule }] = await Promise.all([api('classes_list'), api('schedule_list')]);
      setClasses(classes);
      setEntries(schedule);
    })().catch((e) => setError(e.message));
  }, []);

  function update(i, field, value) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
    setSaved(false);
  }

  function addRow() {
    setEntries((prev) => [...prev, {
      dayOfWeek: 0, period: 1, startTime: '08:00', endTime: '08:45',
      classId: classes[0]?.id ?? '', subject: '', mashovSubjectLabel: '',
    }]);
    setSaved(false);
  }

  function removeRow(i) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  async function save() {
    await api('schedule_set', { entries });
    setSaved(true);
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="pill-btn ghost" onClick={onBack}>← חזרה</button>
        <h1 style={{ margin: 0 }}>מערכת שעות שבועית</h1>
        {!saved && <button className="pill-btn" onClick={save}>שמירת שינויים</button>}
      </div>
      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowX: 'auto' }}>
        {entries.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={e.dayOfWeek} onChange={(ev) => update(i, 'dayOfWeek', Number(ev.target.value))}>
              {DAY_NAMES.map((d, idx) => <option key={idx} value={idx}>יום {d}</option>)}
            </select>
            <input type="text" inputMode="numeric" value={e.period} onChange={(ev) => update(i, 'period', Number(ev.target.value))} style={{ width: 40 }} title="שיעור מס'" />
            <input type="text" value={e.startTime} onChange={(ev) => update(i, 'startTime', ev.target.value)} style={{ width: 70 }} placeholder="08:00" />
            <span>–</span>
            <input type="text" value={e.endTime} onChange={(ev) => update(i, 'endTime', ev.target.value)} style={{ width: 70 }} placeholder="08:45" />
            <select value={e.classId} onChange={(ev) => update(i, 'classId', Number(ev.target.value))}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="text" value={e.subject} onChange={(ev) => update(i, 'subject', ev.target.value)} placeholder="מקצוע (ביולוגיה)" style={{ flex: 1 }} />
            <button className="pill-btn ghost" onClick={() => removeRow(i)}>מחיקה</button>
          </div>
        ))}
      </div>

      <button className="pill-btn secondary" onClick={addRow}>הוספת שיעור</button>
    </div>
  );
}
