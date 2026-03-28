/* ==========================================================================
   DevToolsHub — Service Worker
   Caches static assets for offline support and faster repeat visits.
   Strategy: Cache-First for assets, Network-First for HTML pages.
   ========================================================================== */

const CACHE_NAME = 'devtoolshub-v1';

const STATIC_ASSETS = [
  '/',
  '/assets/css/global.css',
  '/assets/css/home.css',
  '/assets/js/global.js',
  '/assets/images/logo.svg',
  '/manifest.json'
];

/* ── Install: Pre-cache core static assets ── */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ── Activate: Clean up old caches ── */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

/* ── Fetch: Cache-First for assets, Network-First for pages ── */
self.addEventListener('fetch', function (event) {
  var request = event.request;

  /* Only handle GET requests */
  if (request.method !== 'GET') {
    return;
  }

  var url = new URL(request.url);

  /* Skip external requests */
  if (url.origin !== self.location.origin) {
    return;
  }

  /* Static assets → Cache-First */
  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then(function (cached) {
        return cached || fetch(request).then(function (response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, clone);
          });
          return response;
        });
      })
    );
    return;
  }

  /* HTML pages → Network-First with cache fallback */
  event.respondWith(
    fetch(request)
      .then(function (response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, clone);
        });
        return response;
      })
      .catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match('/');
        });
      })
  );
});
