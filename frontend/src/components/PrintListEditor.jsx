import { useEffect, useRef, useState } from 'react';

const blank = () => ({ title: '', url: '', copies: 1, pages: 0, note: '' });

function PrinterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const clean = (items) => items
  .filter((p) => p.title.trim() || p.url.trim())
  .map((p) => ({
    title: p.title.trim(), url: p.url.trim(),
    copies: Math.max(1, Number(p.copies) || 1), pages: Math.max(0, Number(p.pages) || 0), note: (p.note || '').trim(),
  }));

// עורך רשימת קבצים להדפסה לשיעור: שם, קישור, עמודים, עותקים. נשמר ביציאה משדה (רק כשיש שינוי אמיתי).
export default function PrintListEditor({ value, onCommit, compact }) {
  const [items, setItems] = useState(() => (value && value.length ? value.map((p) => ({ ...blank(), ...p })) : []));
  const committed = useRef(JSON.stringify(clean(items)));
  const dirty = useRef(false);

  // עדכון מבחוץ (סנכרון) — רק אם לא באמצע עריכה
  useEffect(() => {
    const incoming = JSON.stringify(clean((value || []).map((p) => ({ ...blank(), ...p }))));
    if (!dirty.current && incoming !== committed.current) {
      committed.current = incoming;
      setItems((value || []).map((p) => ({ ...blank(), ...p })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value || [])]);

  function commit(next) {
    const c = JSON.stringify(clean(next));
    dirty.current = false;
    if (c === committed.current) return;
    committed.current = c;
    onCommit(clean(next));
  }

  function patch(i, field, v) {
    dirty.current = true;
    setItems((cur) => cur.map((p, k) => (k === i ? { ...p, [field]: v } : p)));
  }

  function remove(i) {
    const next = items.filter((_, k) => k !== i);
    setItems(next);
    commit(next);
  }

  const small = { padding: '4px 8px', fontSize: '0.85rem' };
  const num = { ...small, width: 54, textAlign: 'center' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: compact ? '0.8rem' : '0.85rem', fontWeight: 600, opacity: 0.75 }}>
        <PrinterIcon />להדפסה
        {items.length > 0 && <span style={{ fontWeight: 400, opacity: 0.7 }}>· עמודים × עותקים</span>}
      </div>
      {items.map((p, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px', borderRadius: 12, background: 'rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="text" placeholder="שם הקובץ" value={p.title} style={{ ...small, flex: 1, minWidth: 0 }}
              onChange={(e) => patch(i, 'title', e.target.value)} onBlur={() => commit(items)} />
            <label title="מספר עמודים" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', opacity: 0.8 }}>
              עמ׳<input type="number" min="0" inputMode="numeric" value={p.pages || ''} style={num}
                onChange={(e) => patch(i, 'pages', e.target.value)} onBlur={() => commit(items)} />
            </label>
            <label title="מספר עותקים" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', opacity: 0.8 }}>
              עותקים<input type="number" min="1" inputMode="numeric" value={p.copies} style={num}
                onChange={(e) => patch(i, 'copies', e.target.value)} onBlur={() => commit(items)} />
            </label>
            <button className="pill-btn ghost" title="הסרה" style={{ padding: '4px 6px', color: 'var(--color-removal)' }} onClick={() => remove(i)}><XIcon /></button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" inputMode="url" dir="ltr" placeholder="קישור לקובץ (אופציונלי)" value={p.url} style={{ ...small, flex: 1, minWidth: 0, textAlign: 'start' }}
              onChange={(e) => patch(i, 'url', e.target.value)} onBlur={() => commit(items)} />
            <input type="text" placeholder="הערה (למשל: דו־צדדי, צבעוני)" value={p.note} style={{ ...small, flex: 1, minWidth: 0 }}
              onChange={(e) => patch(i, 'note', e.target.value)} onBlur={() => commit(items)} />
          </div>
        </div>
      ))}
      <button className="pill-btn secondary" style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '0.8rem' }}
        onClick={() => { dirty.current = true; setItems((cur) => [...cur, blank()]); }}>
        + הוספת קובץ להדפסה
      </button>
    </div>
  );
}
