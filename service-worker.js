/* Simple, robust service-worker for workout-planner
   - Caches core app shell on install (offline-first)
   - Runtime-caches same-origin requests (images, pages)
   - Provides navigation fallback to index.html for SPA-like behavior
   - Increment CACHE_VERSION to force clients to refresh caches when you deploy updates
*/

const CACHE_VERSION = 'v1.1'; // bump this when you deploy changes
const CACHE_NAME = `desifit-${CACHE_VERSION}`;
const BASE_PATH = '/workout-planner';
const INDEX_HTML = BASE_PATH + '/index.html';

const CORE_ASSETS = [
  BASE_PATH + '/',
  INDEX_HTML,
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/icons/icon-192.png',
  BASE_PATH + '/icons/icon-512.png'
];

// Install: pre-cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()))
    )).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for precached assets, then network with runtime caching for same-origin requests.
// Navigation requests fallback to index.html (helpful if user opens route directly)
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Always try cache-first for app shell requests
  if (CORE_ASSETS.includes(url.pathname) || url.pathname === BASE_PATH + '/' || url.pathname === INDEX_HTML) {
    event.respondWith(caches.match(req).then(resp => resp || fetch(req).then(fetchResp => {
      // update cache
      const copy = fetchResp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      return fetchResp;
    })).catch(() => caches.match(INDEX_HTML)));
    return;
  }

  // For navigation (page loads) fallback to index.html when offline
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then(netResp => {
        // optionally cache the page
        const copy = netResp.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return netResp;
      }).catch(() => caches.match(INDEX_HTML))
    );
    return;
  }

  // For same-origin static resources (images, CSS, JS) use stale-while-revalidate style
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const networkFetch = fetch(req).then(networkResp => {
          // put the latest into cache (don't cache POSTs)
          if (networkResp && networkResp.status === 200) {
            const copy = networkResp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return networkResp;
        }).catch(() => undefined);

        // prefer cached if available, otherwise wait for network
        return cached || networkFetch;
      })
    );
    return;
  }

  // For cross-origin resources (CDNs) just try network, fallback to cache if present
  event.respondWith(
    fetch(req).then(resp => resp).catch(() => caches.match(req))
  );
});

// Optional: message handler to let clients know a new service-worker is waiting (useful if you add UI to notify users)
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
