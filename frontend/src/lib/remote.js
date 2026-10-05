const BASE = '/talap/backend/api/index.php';

export function getKey() {
  try { return localStorage.getItem('talap_key') || ''; } catch { return ''; }
}
export function setKey(key) {
  try { localStorage.setItem('talap_key', key); } catch { /* private mode etc */ }
}
export function clearKey() {
  try { localStorage.removeItem('talap_key'); } catch { /* noop */ }
}

export class ApiRequestError extends Error {
  constructor(message, status, extra) {
    super(message);
    this.status = status;
    this.extra = extra || {};
  }
}

// קריאה גולמית לשרת. שגיאת רשת/פסק זמן נזרקת כ-TypeError/AbortError (לא ApiRequestError),
// שגיאת HTTP נזרקת כ-ApiRequestError עם status.
export async function remote(action, body = null, timeoutMs = 20000) {
  const url = `${BASE}?action=${encodeURIComponent(action)}`;
  const opts = {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Key': getKey(), 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new ApiRequestError(data.error || `שגיאה (${res.status})`, res.status, data);
    return data;
  } finally {
    clearTimeout(timer);
  }
}
