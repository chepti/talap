const collator = new Intl.Collator('he');

// שמות שמורים כ"משפחה פרטי" (כמו ברשימת משו"ב). שם משפחה = המילה הראשונה, שם פרטי = המילה השנייה.
function keyOf(student, sortBy) {
  const parts = (student.fullName || '').trim().split(/\s+/);
  if (sortBy === 'first') return [parts[1] ?? parts[0] ?? '', parts[0] ?? ''];
  return [parts[0] ?? '', parts[1] ?? ''];
}

function initials(name) {
  return (name || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('');
}

export function sortStudents(students, sortBy) {
  return [...students].sort((a, b) => {
    const [a1, a2] = keyOf(a, sortBy);
    const [b1, b2] = keyOf(b, sortBy);
    return collator.compare(a1, b1) || collator.compare(a2, b2);
  });
}

export default function StudentList({ students, dotsByStudent, sortBy, onSortChange, onPick, toolbar }) {
  const sorted = sortStudents(students, sortBy);
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
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6, background: 'rgba(255,255,255,0.55)', borderRadius: 999, padding: 4 }}>
          {[['last', 'לפי שם משפחה'], ['first', 'לפי שם פרטי']].map(([k, label]) => (
            <button key={k} className={`pill-btn ${sortBy === k ? '' : 'ghost'}`} style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              onClick={() => onSortChange(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8, alignContent: 'start',
      }}>
        {sorted.map((s) => {
          const dots = dotsByStudent[s.id] || [];
          return (
            <button key={s.id} onClick={() => onPick(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12,
              background: '#fffdf8', border: '1px solid var(--color-border)', textAlign: 'start', minHeight: 58,
            }}>
              {s.photoUrl ? (
                <img src={s.photoUrl} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', flex: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
                }}>{initials(s.fullName)}</div>
              )}
              <span style={{ flex: 1, fontWeight: 600, fontSize: '0.95rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.fullName}</span>
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
