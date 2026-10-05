const CACHE = 'talap-v3';
const SHELL = [
  '/talap/', '/talap/manifest.webmanifest', '/talap/favicon.svg',
  '/talap/login-bg.png', '/talap/login-bg-wide.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // קבצי JS/CSS עם גיבוב בשם — מגלים אותם מתוך index.html ושומרים מראש, כדי שהאפליקציה תיפתח גם בלי רשת
    try {
      const html = await (await fetch('/talap/', { cache: 'reload' })).text();
      const assets = [...html.matchAll(/(?:src|href)="(\/talap\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await cache.addAll(assets);
    } catch { /* ייתפסו בריצה הראשונה */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await refresh) || Response.error();
}

// html/js/css: קודם רשת (עדכוני קוד מופיעים מיד), אבל עם פסק זמן קצר — ברשת איטית/אופליין עוברים למטמון
async function networkFirst(req, ms) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = (await cache.match(req)) || (req.mode === 'navigate' ? await cache.match('/talap/') : null);
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // קריאות API לעולם לא במטמון — הנתונים המקומיים מנוהלים באפליקציה עצמה (IndexedDB)
    if (url.pathname.includes('/backend/api/')) return;
    if (url.pathname.startsWith('/talap/assets/')) { event.respondWith(cacheFirst(req)); return; }
    if (/\.(png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) { event.respondWith(staleWhileRevalidate(req)); return; }
    event.respondWith(networkFirst(req, 3000));
    return;
  }

  // גופן Fredoka מ-Google Fonts — נשמר אחרי הטעינה הראשונה כדי שגם אופליין ייראה אותו דבר
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req));
  }
});
