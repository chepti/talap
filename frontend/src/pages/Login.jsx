import { useState } from 'react';
import { api, setKey } from '../lib/api';

export default function Login({ onSuccess }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError('');
    setKey(value.trim());
    try {
      await api('state');
      onSuccess();
    } catch (err) {
      setError(err.status === 401 ? 'מפתח שגוי' : 'שגיאת חיבור לשרת');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} className="card" style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', textAlign: 'center' }}>תלפ</h1>
        <p style={{ margin: 0, textAlign: 'center', opacity: 0.7 }}>הזני את מפתח הכניסה</p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="מפתח כניסה"
          autoFocus
        />
        {error && <div style={{ color: 'var(--color-removal)', fontSize: '0.9rem' }}>{error}</div>}
        <button className="pill-btn" type="submit" disabled={busy}>{busy ? 'בודקת…' : 'כניסה'}</button>
      </form>
    </div>
  );
}
