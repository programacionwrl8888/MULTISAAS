const CACHE_NAME = 'meds-pwa-v1';
const ASSETS = [
  './index.html',
  './app.js',
  './manifest.json',
  'https://jsdelivr.net',
  'https://jsdelivr.net'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
