import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function ClassPicker({ onPick, onOpenRoster, onOpenSchedule }) {
  const [classes, setClasses] = useState(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const { classes } = await api('classes_list');
      setClasses(classes);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function addClass(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await api('classes_upsert', { name });
    setNewName('');
    load();
  }

  if (!classes) return <div style={{ padding: 24 }}>טוענת…</div>;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      <h1 style={{ margin: 0 }}>בחירת כיתה</h1>
      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {classes.map((c) => (
          <button key={c.id} className="pill-btn secondary" style={{ fontSize: '1.2rem', padding: '18px 32px' }} onClick={() => onPick(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      <form onSubmit={addClass} style={{ display: 'flex', gap: 10 }}>
        <input type="text" placeholder="שם כיתה חדשה (למשל: ח2)" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="pill-btn" type="submit">הוספת כיתה</button>
      </form>

      <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
        <button className="pill-btn ghost" onClick={onOpenRoster}>ניהול תלמידים</button>
        <button className="pill-btn ghost" onClick={onOpenSchedule}>מערכת שעות</button>
      </div>
    </div>
  );
}
