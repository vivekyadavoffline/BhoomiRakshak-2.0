const CACHE_NAME = 'bhoomi-rakshak-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
