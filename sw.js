// LoopMark Service Worker
// IMPORTANT: bump APP_VERSION on every deploy that ships changed assets,
// otherwise returning visitors will keep seeing the cached version.
// You can automate this in CI by sed-replacing APP_VERSION with a git SHA
// or a timestamp before `netlify deploy`.
const APP_VERSION = '2026-05-21-1';
const CACHE = 'loopmark-' + APP_VERSION;

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
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {/* tolerate cross-origin font failures */}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only cache GETs
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isYT = url.hostname.includes('youtube') || url.hostname.includes('ytimg');
  const isApi = url.pathname.startsWith('/.netlify/functions/');
  const isSupabase = url.hostname.includes('supabase.co');

  // Never cache YouTube embed traffic, our own API calls, or Supabase
  if (isYT || isApi || isSupabase) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // STRATEGY: Network-First for HTML pages
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

  // STRATEGY: Cache-First for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
