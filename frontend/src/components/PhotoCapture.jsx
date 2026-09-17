import { useRef, useState } from 'react';

const VIEWPORT = 260;
const OUTPUT = 240;

export default function PhotoCapture({ onSave, onCancel }) {
  const fileInputRef = useRef(null);
  const [imgEl, setImgEl] = useState(null); // HTMLImageElement, loaded
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null); // { startX, startY, startOffset }

  function pickFile() {
    fileInputRef.current?.click();
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setScale(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = url;
  }

  function baseScale() {
    if (!imgEl) return 1;
    return VIEWPORT / Math.min(imgEl.naturalWidth, imgEl.naturalHeight);
  }

  function totalScale() {
    return baseScale() * scale;
  }

  function dispSize() {
    const s = totalScale();
    return { w: imgEl.naturalWidth * s, h: imgEl.naturalHeight * s };
  }

  function clamp(offsetX, offsetY) {
    const { w, h } = dispSize();
    const maxX = Math.max(0, (w - VIEWPORT) / 2);
    const maxY = Math.max(0, (h - VIEWPORT) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, offsetX)),
      y: Math.min(maxY, Math.max(-maxY, offsetY)),
    };
  }

  function onPointerDown(e) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clamp(dragRef.current.startOffset.x + dx, dragRef.current.startOffset.y + dy));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function confirm() {
    const s = totalScale();
    const { w, h } = dispSize();
    const left = VIEWPORT / 2 + offset.x - w / 2;
    const top = VIEWPORT / 2 + offset.y - h / 2;
    const srcX = -left / s;
    const srcY = -top / s;
    const srcSize = VIEWPORT / s;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);
    onSave(canvas.toDataURL('image/jpeg', 0.82));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />

        {!imgEl && (
          <>
            <span>צילום תמונה או בחירה מהגלריה</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pill-btn" onClick={pickFile}>פתיחת מצלמה</button>
              <button className="pill-btn ghost" onClick={onCancel}>ביטול</button>
            </div>
          </>
        )}

        {imgEl && (
          <>
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{
                width: VIEWPORT, height: VIEWPORT, borderRadius: '50%', overflow: 'hidden',
                position: 'relative', touchAction: 'none', cursor: 'grab',
                border: '3px solid var(--color-primary)', background: '#eee',
              }}
            >
              <img
                src={imgEl.src}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  width: dispSize().w, height: dispSize().h,
                  left: VIEWPORT / 2 + offset.x - dispSize().w / 2,
                  top: VIEWPORT / 2 + offset.y - dispSize().h / 2,
                  pointerEvents: 'none',
                }}
              />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
              הקטנה/הגדלה
              <input type="range" min="1" max="3" step="0.05" value={scale}
                onChange={(e) => { setScale(Number(e.target.value)); setOffset((o) => clamp(o.x, o.y)); }}
                style={{ flex: 1 }} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pill-btn secondary" onClick={pickFile}>תמונה אחרת</button>
              <button className="pill-btn" onClick={confirm}>אישור וחיתוך</button>
              <button className="pill-btn ghost" onClick={onCancel}>ביטול</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
