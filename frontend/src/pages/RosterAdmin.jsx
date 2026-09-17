import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function RosterAdmin({ onBack }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [newName, setNewName] = useState('');
  const [importText, setImportText] = useState('');
  const [error, setError] = useState('');

  async function loadClasses() {
    const { classes } = await api('classes_list');
    setClasses(classes);
    if (!classId && classes.length) setClassId(classes[0].id);
  }

  async function loadStudents(cid) {
    if (!cid) { setStudents([]); return; }
    const { students } = await api('students_list', { classId: cid });
    setStudents(students);
  }

  useEffect(() => { loadClasses().catch((e) => setError(e.message)); }, []);
  useEffect(() => { loadStudents(classId).catch((e) => setError(e.message)); }, [classId]);

  async function addStudent(e) {
    e.preventDefault();
    const fullName = newName.trim();
    if (!fullName || !classId) return;
    await api('students_upsert', { classId, fullName });
    setNewName('');
    loadStudents(classId);
  }

  async function removeStudent(id) {
    await api('students_delete', { id });
    loadStudents(classId);
  }

  async function updateField(id, field, value) {
    await api('students_upsert', { id, [field]: value });
  }

  async function doImport() {
    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length || !classId) return;
    const rows = lines.map((line) => {
      const [fullName, mashovMatch] = line.split(',').map((s) => s?.trim());
      return { fullName, mashovMatch };
    });
    await api('students_import', { classId, rows });
    setImportText('');
    loadStudents(classId);
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="pill-btn ghost" onClick={onBack}>← חזרה</button>
        <h1 style={{ margin: 0 }}>ניהול תלמידים</h1>
      </div>
      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

      <select value={classId ?? ''} onChange={(e) => setClassId(Number(e.target.value))}>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {students.map((s) => (
          <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="text" defaultValue={s.fullName} onBlur={(e) => updateField(s.id, 'fullName', e.target.value)} style={{ flex: 1 }} />
            <input type="text" defaultValue={s.mashovMatch} placeholder="שם לחיפוש במשוב" onBlur={(e) => updateField(s.id, 'mashovMatch', e.target.value)} style={{ flex: 1 }} />
            <button className="pill-btn ghost" onClick={() => removeStudent(s.id)}>מחיקה</button>
          </div>
        ))}
        {!students.length && <div style={{ opacity: 0.6 }}>אין תלמידים בכיתה זו עדיין</div>}
      </div>

      <form onSubmit={addStudent} style={{ display: 'flex', gap: 8 }}>
        <input type="text" placeholder="שם תלמיד/ה" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="pill-btn" type="submit">הוספה</button>
      </form>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>ייבוא מרשימה (שם אחד בכל שורה, אופציונלי: שם, שם-לחיפוש-במשוב)</span>
        <textarea rows={5} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'דנה כהן\nעומר לוי, עומר לוי-אבני'} />
        <button className="pill-btn secondary" onClick={doImport}>ייבוא</button>
      </div>
    </div>
  );
}
