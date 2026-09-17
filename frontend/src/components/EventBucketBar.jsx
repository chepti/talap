const TYPES = [
  { key: 'late', label: 'איחור', color: 'var(--color-late)' },
  { key: 'absent', label: 'חיסור', color: 'var(--color-absent)' },
  { key: 'positive', label: 'חיזוק חיובי', color: 'var(--color-positive)' },
  { key: 'disturb', label: 'הפרעה', color: 'var(--color-disturb)' },
  { key: 'homework', label: 'ש.ב', color: 'var(--color-homework)' },
  { key: 'removal', label: 'הרחקה', color: 'var(--color-removal)' },
  { key: 'noEquipment', label: 'ציוד', color: 'var(--color-noEquipment)' },
];

export { TYPES as EVENT_TYPES };
export const EDIT_KEY = '__edit__';

function BucketObject({ color, lifted }) {
  const gid = 'bg-' + color.replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg width="46" height="54" viewBox="0 0 46 54" style={{ transform: lifted ? 'translateY(-4px)' : 'none', transition: 'transform 0.15s ease' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <ellipse cx="23" cy="49" rx="14" ry="3.4" fill="rgba(40,25,10,0.25)" />
      <path d="M12 10c0-3.6 4.9-5.2 11-5.2S34 6.4 34 10" fill="none" stroke="#9b7a55" strokeWidth="3" strokeLinecap="round" />
      <path d="M9 12h28l-3.4 30a3.4 3.4 0 0 1-3.4 3H15.8a3.4 3.4 0 0 1-3.4-3L9 12Z" fill="#fffaf0" stroke="#d8cbb0" strokeWidth="1.5" />
      <path d="M10.4 15.5h25.2" stroke="#d8cbb0" strokeWidth="1.2" />
      <path d="M10.6 15.5c0 3.6 5.6 5.5 12.4 5.5s12.4-1.9 12.4-5.5" fill={`url(#${gid})`} />
      <path d="M19 20c-1.3 4-3.6 6.8-2.6 10.8 1 4 5.6 4 6.4 0 .6-3-1.6-5.6-1.4-8.6" fill={color} />
    </svg>
  );
}

function EditObject() {
  return (
    <svg width="46" height="54" viewBox="0 0 46 54">
      <ellipse cx="23" cy="49" rx="14" ry="3.4" fill="rgba(40,25,10,0.25)" />
      <rect x="10" y="10" width="26" height="34" rx="4" fill="#fff" stroke="#d8cbb0" strokeWidth="1.5" transform="rotate(-6 23 27)" />
      <path d="M15 20h14M15 27h14M15 34h9" stroke="#cfc3ab" strokeWidth="2" strokeLinecap="round" transform="rotate(-6 23 27)" />
      <path d="M27 33 39 15l3 2-11 19-4.5 1.5Z" fill="#f2b134" stroke="#8a5a1e" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M39 15l3 2" stroke="#8a5a1e" strokeWidth="1.3" />
    </svg>
  );
}

export default function EventBucketBar({ active, onSelect }) {
  const items = [...TYPES, { key: EDIT_KEY, label: 'עריכת סימון', color: '#8a7a63', edit: true }];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end', padding: '4px 8px' }}>
      {items.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onSelect(isActive ? null : t.key)}
            title={t.label}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'transparent', border: 'none', padding: '4px 8px', width: 68,
            }}
          >
            {t.edit ? <EditObject /> : <BucketObject color={t.color} lifted={isActive} />}
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, color: isActive ? t.color : '#5a4a35',
              background: isActive ? '#fff' : 'transparent',
              padding: isActive ? '1px 8px' : 0, borderRadius: 'var(--radius-pill)',
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
              whiteSpace: 'nowrap',
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
