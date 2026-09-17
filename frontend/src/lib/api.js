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

class ApiRequestError extends Error {
  constructor(message, status, extra) {
    super(message);
    this.status = status;
    this.extra = extra || {};
  }
}

export async function api(action, body = null, query = null) {
  const key = getKey();
  let url = `${BASE}?action=${encodeURIComponent(action)}`;
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
    }
  }
  const opts = {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Key': key, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    throw new ApiRequestError(data.error || `שגיאה (${res.status})`, res.status, data);
  }
  return data;
}

export { ApiRequestError };
