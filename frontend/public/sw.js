const CACHE = 'talap-shell-v2';
const SHELL = ['/talap/', '/talap/manifest.webmanifest', '/talap/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// אף פעם לא לשמור במטמון קריאות API — הנתונים חייבים להיות תמיד עדכניים.
// html/js/css: תמיד קודם רשת (network-first), כדי שעדכוני קוד יתפשטו מיד;
// המטמון משמש רק כגיבוי כשאין רשת. תמונות/אייקונים: cache-first, כי לא משתנים.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('/backend/api/')) return;
  if (event.request.method !== 'GET') return;

  const isAsset = /\.(png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
      return res;
    }).catch(() => caches.match(event.request))
  );
});
