const VERSION = 'gentle-chase-v1';
const SHELL = [
  '/', '/index.html', '/offline.html', '/manifest.webmanifest', '/robots.txt',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/icon-maskable-512.png', '/assets/hero-topography-768.webp',
  '/assets/hero-topography.webp', '/assets/hero-topography.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const isUpdate = keys.some((key) => key.startsWith('gentle-chase-') && key !== VERSION);
    await caches.open(VERSION).then((cache) => cache.addAll(SHELL));
    if (isUpdate) await caches.open(VERSION).then((cache) => cache.put('/update-signal', new Response('1')));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
    const updated = await caches.match('/update-signal');
    if (updated) {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.postMessage({ type: 'UPDATE_AVAILABLE' }));
    }
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(VERSION);
        cache.put('/index.html', response.clone());
        return response;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/offline.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached && url.pathname !== '/update-signal') return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(VERSION);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
