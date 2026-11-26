import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

// הגדרות המייל השבועי של ההדפסות: מתי נשלח, למי, תצוגה מקדימה ושליחה מיידית.
export default function PrintSettings({ onClose }) {
  const [s, setS] = useState(null);
  const [recipients, setRecipients] = useState('');
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('print_settings_get').then(({ settings }) => {
      setS(settings);
      setRecipients((settings.recipients || []).join('\n'));
    }).catch((e) => setMsg(e.message));
  }, []);

  if (!s) return <div className="card">{msg || 'טוענת…'}</div>;

  async function save() {
    setBusy(true); setMsg('');
    try {
      const { settings } = await api('print_settings_set', {
        enabled: s.enabled, dayOfWeek: s.dayOfWeek, hour: s.hour, recipients,
      });
      setS(settings);
      setRecipients((settings.recipients || []).join('\n'));
      setMsg(settings.enabled && !settings.recipients.length ? 'נשמר — אבל חסרה כתובת מייל תקינה, אז לא יישלח' : 'נשמר');
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  async function doPreview() {
    setBusy(true); setMsg('');
    try { setPreview(await api('print_digest', { preview: true })); } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  async function sendNow() {
    setBusy(true); setMsg('');
    try {
      await save();
      const r = await api('print_digest', {});
      setMsg(r.sent ? `נשלח ל-${r.recipients.join(', ')} (${r.count} קבצים, ${r.sheets} דפים)` : (r.reason === 'nothing to print' ? 'אין כרגע קבצים להדפסה לשבוע הקרוב' : `השליחה נכשלה${r.failed?.length ? ' ל-' + r.failed.join(', ') : ''}`));
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <b style={{ flex: 1 }}>מייל הדפסות שבועי</b>
        <button className="pill-btn ghost" style={{ padding: '4px 12px' }} onClick={onClose}>סגירה</button>
      </div>
      <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>
        כל קובץ שסימנת להדפסה בתכנון השיעורים נאסף למייל אחד מסודר (עם קישורים, עותקים ועמודים) לשבוע שמתחיל למחרת היום שנבחר.
      </span>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} style={{ width: 18, height: 18 }} />
        שליחה אוטומטית פעילה
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>בכל יום</span>
        <select value={s.dayOfWeek} onChange={(e) => setS({ ...s, dayOfWeek: Number(e.target.value) })}>
          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <span>בשעה</span>
        <select value={s.hour} onChange={(e) => setS({ ...s, hour: Number(e.target.value) })}>
          {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
        </select>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>כתובות מייל לשליחה (אחת בכל שורה)</span>
        <textarea rows={3} dir="ltr" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="name@example.com" style={{ textAlign: 'start' }} />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="pill-btn" disabled={busy} onClick={save}>שמירה</button>
        <button className="pill-btn secondary" disabled={busy} onClick={doPreview}>תצוגה מקדימה</button>
        <button className="pill-btn secondary" disabled={busy} onClick={sendNow}>שליחה עכשיו</button>
      </div>
      {msg && <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{msg}</div>}
      {preview && (
        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <b>{preview.subject}</b>
          {preview.items.length === 0 && <span style={{ opacity: 0.6 }}>אין קבצים להדפסה בטווח הזה.</span>}
          {preview.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border)', padding: '2px 0' }}>
              <span style={{ opacity: 0.6 }}>{it.date.slice(5).split('-').reverse().join('.')} · {it.class}</span>
              <span style={{ flex: 1 }}>{it.title}</span>
              <span>{it.copies} × {it.pages || '?'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
