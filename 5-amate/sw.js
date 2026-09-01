const CACHE_NAME = 'amate-cache-v1';
const ASSETS = ['./index.html', './app.js', './manifest.json', 'https://jsdelivr.net', 'https://jsdelivr.net', 'https://cloudflare.com'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))); });
self.addEventListener('fetch', (e) => { e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request))); });
