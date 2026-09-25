import { useState } from 'react';
import { api, setKey } from '../lib/api';
import { useAppBackground } from '../lib/useBackground';

export default function Login({ onSuccess }) {
  const bg = useAppBackground();
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
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundImage: `linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.7)), url(${bg})`,
      backgroundSize: 'cover', backgroundPosition: 'center',
    }}>
      <form onSubmit={submit} className="card" style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', textAlign: 'center' }}>תלפ</h1>
        <p style={{ margin: 0, textAlign: 'center', opacity: 0.7 }}>הזני את מפתח הכניסה</p>
        {/* שם משתמש קבוע ונסתר: כדי שהדפדפן ישמור את המפתח בנפרד משאר האפליקציות ב-chepti.com */}
        <input type="text" name="username" autoComplete="username" value="talap" readOnly style={{ display: 'none' }} />
        <input
          type="password"
          autoComplete="current-password"
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
