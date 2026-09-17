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

export default function EventBucketBar({ active, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '10px 0' }}>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 2 5 15v5a2 2 0 0 0 2 2h5" />
              <path d="M11.5 5.5 18.5 12.5" />
              <path d="M2 22c1.5-2 3-2 4-1s2.5 1 4-1" />
            </svg>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
