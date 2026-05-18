const CACHE = 'loopmark-v5'; // Bumped the version!
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', e => {
  self.skipWaiting(); // Forces the new service worker to take over immediately
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // Takes control of all open tabs immediately
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isYT = url.hostname.includes('youtube') || url.hostname.includes('ytimg');

  if (isYT) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // STRATEGY: Network-First for HTML pages
  // Always tries to fetch the newest version, falls back to offline cache if no internet
  if (e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // STRATEGY: Cache-First for static assets (images, fonts, manifest)
  // Keeps the app loading lightning fast for heavy files
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});