import { useRef, useState } from 'react';

const OUTPUT = 240;

// תמונה קבוצתית (מהגלריה או מהמצלמה): מסמנים פנים בתמונה, בוחרים מי זו, והחיתוך נשמר כתמונת הפרופיל שלה.
export default function GroupPhotoTagger({ students, onSave, onClose }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const imgRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [mark, setMark] = useState(null); // { x, y } ביחס לתמונה המוצגת (0..1)
  const [size, setSize] = useState(0.12); // חלק מהצלע הקצרה של התמונה
  const [studentId, setStudentId] = useState(null);
  const [done, setDone] = useState({}); // studentId -> true
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSrc(URL.createObjectURL(file));
    setMark(null);
    setStudentId(null);
    setDone({});
  }

  function onTap(e) {
    const r = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setMark({ x, y });
  }

  async function save() {
    if (!mark || !studentId) return;
    setBusy(true); setError('');
    try {
      const img = imgRef.current;
      const nw = img.naturalWidth; const nh = img.naturalHeight;
      const side = Math.min(nw, nh) * size;
      const left = Math.min(Math.max(0, mark.x * nw - side / 2), nw - side);
      const top = Math.min(Math.max(0, mark.y * nh - side / 2), nh - side);
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT; canvas.height = OUTPUT;
      canvas.getContext('2d').drawImage(img, left, top, side, side, 0, 0, OUTPUT, OUTPUT);
      await onSave(studentId, canvas.toDataURL('image/jpeg', 0.85));
      setDone((d) => ({ ...d, [studentId]: true }));
      setMark(null);
      setStudentId(null);
    } catch (err) {
      setError(err.message || 'השמירה נכשלה');
    }
    setBusy(false);
  }

  const imgSide = imgRef.current ? Math.min(imgRef.current.clientWidth, imgRef.current.clientHeight) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
      <input ref={galleryRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 'min(960px, 100%)', maxHeight: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ flex: 1 }}>תמונה קבוצתית — סימון פנים</b>
          <button className="pill-btn secondary" onClick={() => cameraRef.current?.click()}>צילום</button>
          <button className="pill-btn secondary" onClick={() => galleryRef.current?.click()}>{src ? 'תמונה אחרת מהגלריה' : 'בחירה מהגלריה'}</button>
          <button className="pill-btn ghost" onClick={onClose}>סיום</button>
        </div>

        {!src && <span style={{ opacity: 0.7 }}>בחרי תמונה שבה כמה תלמידות. אחר כך לוחצים על פנים בתמונה, בוחרים מי זו, והחיתוך נשמר בפרופיל שלה.</span>}

        {src && (
          <>
            <div style={{ position: 'relative', alignSelf: 'center', lineHeight: 0, touchAction: 'manipulation' }}>
              <img ref={imgRef} src={src} alt="" onClick={onTap} draggable={false}
                style={{ maxWidth: '100%', maxHeight: '52vh', borderRadius: 12, cursor: 'crosshair', display: 'block' }} />
              {mark && imgRef.current && (
                <div style={{
                  position: 'absolute', pointerEvents: 'none', border: '3px solid #fff', boxShadow: '0 0 0 2px var(--color-primary)', borderRadius: '50%',
                  width: imgSide * size, height: imgSide * size,
                  left: mark.x * imgRef.current.clientWidth - (imgSide * size) / 2,
                  top: mark.y * imgRef.current.clientHeight - (imgSide * size) / 2,
                }} />
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px' }}>
                גודל החיתוך
                <input type="range" min="0.04" max="0.4" step="0.01" value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ flex: 1 }} />
              </label>
              <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                {!mark ? '1. לחצי על הפנים בתמונה' : !studentId ? '2. בחרי מי זו' : '3. שמירה'}
              </span>
              <button className="pill-btn" disabled={!mark || !studentId || busy} onClick={save}>שמירה כתמונת פרופיל</button>
            </div>
            {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 150, overflowY: 'auto' }}>
              {students.map((s) => (
                <button key={s.id} className={`pill-btn ${studentId === s.id ? '' : 'secondary'}`}
                  style={{ padding: '5px 12px', fontSize: '0.85rem' }} onClick={() => setStudentId(s.id)}>
                  {s.fullName}{done[s.id] ? ' · נשמר' : ''}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
