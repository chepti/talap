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
export const DELETE_KEY = '__delete__';

function BucketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4c0-1.8 2.5-2.5 4-2.5s4 .7 4 2.5" />
      <path d="M5 4h14l-1.7 15.3a2 2 0 0 1-2 1.7H8.7a2 2 0 0 1-2-1.7L5 4Z" />
      <path d="M5.6 10h12.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function EventBucketBar({ active, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '10px 0', alignItems: 'center' }}>
      {TYPES.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onSelect(isActive ? null : t.key)}
            title={t.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              borderRadius: 'var(--radius-pill)', padding: '10px 18px',
              background: isActive ? t.color : '#fff',
              color: isActive ? '#fff' : 'var(--color-ink)',
              border: `2px solid ${t.color}`,
              fontWeight: 600, fontSize: '0.95rem',
              boxShadow: isActive ? '0 3px 10px rgba(0,0,0,0.18)' : 'none',
              transform: isActive ? 'translateY(-2px)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <BucketIcon />
            {t.label}
          </button>
        );
      })}

      <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border)', margin: '0 4px' }} />

      <button
        onClick={() => onSelect(active === DELETE_KEY ? null : DELETE_KEY)}
        title="מחיקת סימון"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          borderRadius: 'var(--radius-pill)', padding: '10px 18px',
          background: active === DELETE_KEY ? '#555' : '#fff',
          color: active === DELETE_KEY ? '#fff' : '#555',
          border: '2px solid #555',
          fontWeight: 600, fontSize: '0.95rem',
          boxShadow: active === DELETE_KEY ? '0 3px 10px rgba(0,0,0,0.18)' : 'none',
          transform: active === DELETE_KEY ? 'translateY(-2px)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <TrashIcon />
        מחיקת סימון
      </button>
    </div>
  );
}
