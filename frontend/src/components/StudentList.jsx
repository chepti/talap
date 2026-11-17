const collator = new Intl.Collator('he');

// nameOrder: 'fl' = השם שמור כ"פרטי משפחה" (נעם רזווג), 'lf' = "משפחה פרטי" (כמו ברשימת משו"ב)
export function splitName(fullName, nameOrder) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] || '', last: '' };
  if (nameOrder === 'lf') return { last: parts[0], first: parts.slice(1).join(' ') };
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(' ') };
}

export function sortStudents(students, sortBy, nameOrder) {
  const key = (s) => {
    const { first, last } = splitName(s.fullName, nameOrder);
    return sortBy === 'first' ? [first, last] : [last, first];
  };
  return [...students].sort((a, b) => {
    const [a1, a2] = key(a);
    const [b1, b2] = key(b);
    return collator.compare(a1, b1) || collator.compare(a2, b2);
  });
}

function initials(name) {
  return (name || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('');
}

export default function StudentList({ students, dotsByStudent, sortBy, onSortChange, nameOrder, onNameOrderChange, onPick, toolbar }) {
  const sorted = sortStudents(students, sortBy, nameOrder);
  return (
    <div style={{
      background: 'repeating-linear-gradient(90deg, #c9955b 0 28px, #bd8a4f 28px 30px)',
      borderRadius: 18, padding: 18, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12,
      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        {toolbar && (
          <div style={{ background: 'rgba(255,255,255,0.35)', borderRadius: 14, padding: '4px 6px' }}>{toolbar}</div>
        )}
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.55)', borderRadius: 999, padding: 4 }}>
            {[['last', 'לפי שם משפחה'], ['first', 'לפי שם פרטי']].map(([k, label]) => (
              <button key={k} className={`pill-btn ${sortBy === k ? '' : 'ghost'}`} style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={() => onSortChange(k)}>{label}</button>
            ))}
          </div>
          <button className="pill-btn ghost" style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.55)' }}
            title="בכיתה הזו השמות שמורים בסדר: לחצי כדי להחליף (משפיע על מיון והצגה)"
            onClick={() => onNameOrderChange(nameOrder === 'fl' ? 'lf' : 'fl')}>
            {nameOrder === 'fl' ? 'שמות שמורים: פרטי משפחה' : 'שמות שמורים: משפחה פרטי'}
          </button>
        </div>
      </div>

      {/* טורים: מלמעלה למטה לאורך כל גובה הלוח, ואז טור חדש */}
      <div style={{
        flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden',
        columnWidth: 220, columnGap: 10, columnFill: 'auto',
      }}>
        {sorted.map((s) => {
          const dots = dotsByStudent[s.id] || [];
          const { first, last } = splitName(s.fullName, nameOrder);
          const shown = sortBy === 'first' ? `${first} ${last}` : `${last} ${first}`;
          return (
            <button key={s.id} onClick={() => onPick(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 12, width: '100%',
              background: '#fffdf8', border: '1px solid var(--color-border)', textAlign: 'start', minHeight: 54,
              marginBottom: 8, breakInside: 'avoid',
            }}>
              {s.photoUrl ? (
                <img src={s.photoUrl} alt="" width={38} height={38} style={{ borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
              ) : (
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', flex: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
                }}>{initials(s.fullName)}</div>
              )}
              <span style={{ flex: 1, fontWeight: 600, fontSize: '0.95rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shown}</span>
              {dots.length > 0 && (
                <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
                  {dots.map((d) => (
                    <span key={d.id} title={d.typeLabel + (d.note ? `: ${d.note}` : '')}
                      style={{ width: 14, height: 14, borderRadius: '50%', background: d.color, boxShadow: '0 0 0 1.5px #fff' }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
