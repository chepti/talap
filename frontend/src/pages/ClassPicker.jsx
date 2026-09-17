import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import PhotoCapture from '../components/PhotoCapture';

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export default function ClassPicker({ onPick, onOpenRoster, onOpenSchedule }) {
  const [classes, setClasses] = useState(null);
  const [newName, setNewName] = useState('');
  const [photoClassId, setPhotoClassId] = useState(null);
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

  async function savePhoto(dataUrl) {
    await api('class_photo_upload', { classId: photoClassId, imageBase64: dataUrl });
    setPhotoClassId(null);
    load();
  }

  if (!classes) return <div style={{ padding: 24 }}>טוענת…</div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
        <h1 style={{ margin: 0 }}>בחירת כיתה</h1>
        {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'center', maxWidth: 720 }}>
          {classes.map((c) => (
            <div key={c.id} style={{ position: 'relative', width: 150, height: 110 }}>
              <button
                onClick={() => onPick(c.id)}
                style={{
                  width: '100%', height: '100%', borderRadius: 18, border: '2px solid var(--color-primary)',
                  background: c.photoUrl ? `linear-gradient(rgba(0,0,0,0.05), rgba(0,0,0,0.55)), url(${c.photoUrl})` : '#fff',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 10,
                }}
              >
                <span style={{
                  fontSize: '1.15rem', fontWeight: 700,
                  color: c.photoUrl ? '#fff' : 'var(--color-primary)',
                }}>{c.name}</span>
              </button>
              <button
                onClick={() => setPhotoClassId(c.id)}
                title="הוספת/החלפת תמונה לכיתה"
                style={{
                  position: 'absolute', top: 6, insetInlineEnd: 6, background: 'rgba(255,255,255,0.85)',
                  border: 'none', borderRadius: '50%', width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)',
                }}
              ><CameraIcon /></button>
            </div>
          ))}
        </div>

        <form onSubmit={addClass} style={{ display: 'flex', gap: 10 }}>
          <input type="text" placeholder="שם כיתה חדשה (למשל: ח2)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="pill-btn" type="submit">הוספת כיתה</button>
        </form>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="pill-btn ghost" onClick={onOpenRoster}>ניהול תלמידים</button>
          <button className="pill-btn ghost" onClick={onOpenSchedule}>מערכת שעות</button>
        </div>
      </div>

      {photoClassId != null && (
        <PhotoCapture onSave={savePhoto} onCancel={() => setPhotoClassId(null)} />
      )}
    </div>
  );
}
