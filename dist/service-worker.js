const CACHE_NAME = 'janroku-v16';
const APP_FILES = [
  '/', '/index.html', '/styles.css', '/iphone.css', '/reset-button.css', '/install-guide.css', '/chips-and-readability.css', '/workflow-enhancements.css', '/comfort-theme.css',
  '/app.mjs', '/scoring.mjs', '/storage.mjs', '/manifest.webmanifest', '/icon.svg',
  '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
