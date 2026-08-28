const VERSION = 'gentle-chase-__VERSION__';
const SHELL = __SHELL__;
const UPDATE_SIGNAL = '/update-signal';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // An active worker exists only when this is replacing an installed app.
    // Cache names are build-derived, but this check also keeps the notification
    // correct if a host changes just the worker bytes.
    const isUpdate = Boolean(self.registration.active);
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    if (isUpdate) await cache.put(UPDATE_SIGNAL, new Response('1'));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const isUpdate = Boolean(await cache.match(UPDATE_SIGNAL));
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('gentle-chase-') && key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
    if (isUpdate) {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: 'UPDATE_AVAILABLE' }));
    }
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname === UPDATE_SIGNAL) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(VERSION);
        await cache.put('/index.html', response.clone());
        return response;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/offline.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    // `cache.addAll()` records the precache with simple path requests, while
    // module and stylesheet fetches carry browser-specific request metadata.
    // Match by the same-origin path (and intentionally ignore a cache-busting
    // query) so a first offline reload can always resolve the built shell.
    const cache = await caches.open(VERSION);
    const cached = await cache.match(url.pathname, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
