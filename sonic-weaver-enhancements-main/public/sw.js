const CACHE_NAME = 'sonic-weaver-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((err) => console.warn('Cache install failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .catch((err) => console.warn('Cache activation failed:', err))
  );
  self.clients.claim();
});

// Safe wrappers to prevent DOMException / SecurityError from breaking execution (e.g. in Safari Private Browsing)
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

const putCache = async (request, response) => {
  try {
    if (typeof caches !== 'undefined' && response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response);
    }
  } catch (e) {
    console.warn('Cache put error:', e);
  }
};

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  
  // Navigation requests (HTML pages): ALWAYS network-first
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            putCache(e.request, res.clone());
          }
          return res;
        })
        .catch(async () => {
          const cached = await matchCache(e.request);
          if (cached) return cached;
          const fallback = await matchCache('/app');
          if (fallback) return fallback;
          return fetch(e.request);
        })
    );
    return;
  }

  // Audio pre-caching: network-first with cache fallback
  if (url.pathname.startsWith('/api/music-track')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            putCache(e.request, res.clone());
          }
          return res;
        })
        .catch(() => matchCache(e.request))
    );
    return;
  }
  
  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => matchCache(e.request))
    );
    return;
  }
  
  // Static assets: cache-first
  if (e.request.destination === 'style' || e.request.destination === 'script' || e.request.destination === 'font') {
    e.respondWith(
      (async () => {
        const cached = await matchCache(e.request);
        if (cached) return cached;
        return fetch(e.request)
          .then((res) => {
            if (res.ok) {
              putCache(e.request, res.clone());
            }
            return res;
          })
          .catch(() => new Response('Asset fetch failed', { status: 404 }));
      })()
    );
    return;
  }
  
  // Everything else: network-first
  e.respondWith(
    fetch(e.request).catch(() => matchCache(e.request))
  );
});

// Listen for messages from the app to pre-cache audio
self.addEventListener('message', (e) => {
  if (e.data?.type === 'PRECACHE_AUDIO' && e.data.urls) {
    for (const url of e.data.urls) {
      fetch(url)
        .then((res) => {
          if (res.ok) putCache(url, res);
        })
        .catch(() => {});
    }
  }
});
