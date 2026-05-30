const CACHE_NAME = 'sonic-weaver-landing-v3';
const ASSETS = [
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch((err) => console.warn('Cache install failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .catch((err) => console.warn('Cache activation failed:', err))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Safe wrapper for cache match
  const matchCache = async (request) => {
    try {
      if (typeof caches !== 'undefined') {
        const response = await caches.match(request);
        if (response) return response;
      }
    } catch (e) {
      console.warn('Cache match error:', e);
    }
    return null;
  };

  // Safe wrapper for cache put
  const putCache = async (request, response) => {
    try {
      if (typeof caches !== 'undefined' && response && response.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response);
      }
    } catch (e) {
      console.warn('Cache put error:', e);
    }
  };

  // Navigation requests: ALWAYS network-first to prevent white screen
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            putCache(event.request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await matchCache(event.request);
          if (cached) return cached;
          // Fallback to direct fetch (which will throw if offline, browser's default behavior)
          return fetch(event.request);
        })
    );
    return;
  }

  // Other requests: stale-while-revalidate with robust cache fallbacks
  event.respondWith(
    (async () => {
      const cached = await matchCache(event.request);
      if (cached) {
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              putCache(event.request, response);
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            putCache(event.request, response.clone());
          }
          return response;
        })
        .catch(() => {
          return new Response('Network error', { status: 480, statusText: 'Network Error' });
        });
    })()
  );
});
