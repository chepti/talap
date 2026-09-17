export default function Footer({ onFeedback }) {
  return (
    <footer style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 20px', fontSize: '0.85rem', opacity: 0.75,
    }}>
      <a href="https://chepti.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
        חולמים תקשוב
      </a>
      <button className="pill-btn ghost" style={{ padding: '6px 16px', fontSize: '0.85rem' }} onClick={onFeedback}>
        משוב
      </button>
    </footer>
  );
}
