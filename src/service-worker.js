const CACHE_NAME = 'tanks-a-lot-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './game.js',
  './manifest.json'
];

// Check if we're in development mode (localhost)
const isDevelopment = self.location.hostname === 'localhost' ||
                      self.location.hostname === '127.0.0.1' ||
                      self.location.hostname === '[::1]';

self.addEventListener('install', (event) => {
  // In development, skip waiting and activate immediately
  if (isDevelopment) {
    console.log('[Service Worker] Development mode: Skipping cache installation');
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch((err) => {
        console.error('Service Worker install failed:', err);
        // Don't fail the installation if some files can't be cached
      })
  );
});

self.addEventListener('fetch', (event) => {
  // In development, always fetch from network (bypass cache)
  if (isDevelopment) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if available
        if (response) {
          return response;
        }
        // Otherwise fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                })
                .catch((err) => {
                  console.error('Failed to cache response:', err);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // Return offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            // Return error response for other requests
            return new Response('Offline - Resource not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
      .catch((err) => {
        console.error('Service Worker fetch error:', err);
        return new Response('Service Worker error', {
          status: 500,
          statusText: 'Internal Server Error'
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
