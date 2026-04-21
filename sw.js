/* ============================================================
   EduLearn Service Worker
   - Caches all core files on install
   - Serves from cache when offline
   - Updates cache automatically when new version uploaded
   ============================================================ */

const CACHE_NAME = 'edulearn-v1';

/* Files to cache for offline use */
const CORE_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap'
];

/* ── INSTALL: cache core files ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_FILES).catch(err => {
        console.warn('SW: Some files could not be cached:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: clean old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: serve from cache, fallback to network ── */
self.addEventListener('fetch', event => {
  /* Skip non-GET and chrome-extension requests */
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        /* Serve cached version immediately, update cache in background */
        const fetchPromise = fetch(event.request).then(networkResp => {
          if (networkResp && networkResp.status === 200) {
            const clone = networkResp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResp;
        }).catch(() => {});
        return cached;
      }
      /* Not in cache — try network, cache on success */
      return fetch(event.request).then(networkResp => {
        if (!networkResp || networkResp.status !== 200) return networkResp;
        const clone = networkResp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return networkResp;
      }).catch(() => {
        /* Offline and not cached — return offline page for HTML requests */
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
