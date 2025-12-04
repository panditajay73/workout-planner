const CACHE_NAME = 'desifit-v1';
const BASE_PATH = '/workout-planner';
const OFFLINE_URL = BASE_PATH + '/index.html';

const ASSETS_TO_CACHE = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json',
  // add important assets from your images folder you want cached:
  BASE_PATH + '/icons/icon-192.png',
  BASE_PATH + '/icons/icon-512.png'
  // optional: list other images you want pre-cached, e.g.
  // BASE_PATH + '/images/my-workout-1.gif'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkRes => {
        // runtime cache for same-origin requests
        if (event.request.url.startsWith(self.location.origin + BASE_PATH)) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return networkRes;
      }).catch(() => {
        // navigation fallback when offline
        if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
