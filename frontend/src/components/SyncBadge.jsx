import { useSyncStatus } from '../lib/offline';

function CloudOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 2 20 20" />
      <path d="M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2" />
      <path d="M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10 5.07" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

// מציג מצב רק כשיש מה לדווח: אופליין / פעולות ממתינות / סנכרון / צורך בכניסה מחדש
export default function SyncBadge() {
  const s = useSyncStatus();
  let text = null;
  let tone = '#6b5b45';
  let icon = <CloudOffIcon />;

  if (s.authError) { text = 'נדרשת כניסה מחדש כדי לסנכרן'; tone = 'var(--color-removal)'; }
  else if (!s.online) { text = s.pending ? `אופליין · ${s.pending} פעולות ממתינות לסנכרון` : 'אופליין · הנתונים נשמרים במכשיר'; }
  else if (s.pending || s.syncing) { text = s.pending ? `מסנכרנת… ${s.pending}` : 'מסנכרנת…'; icon = <RefreshIcon />; tone = 'var(--color-primary)'; }

  if (!text) return null;
  return (
    <div style={{
      position: 'fixed', top: 3, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
      display: 'flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 'var(--radius-pill)',
      background: 'rgba(255,255,255,0.92)', color: tone, border: `1px solid ${tone}`,
      fontSize: '0.72rem', fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', pointerEvents: 'none',
    }}>
      {icon}{text}
    </div>
  );
}
