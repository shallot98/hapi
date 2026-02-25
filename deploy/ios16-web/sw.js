/*
 * iOS 16.2 compatibility kill-switch for stale PWA cache.
 * This worker immediately clears caches, unregisters itself,
 * and forces clients to reload from network.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (_) {
      // ignore
    }

    try {
      await self.registration.unregister();
    } catch (_) {
      // ignore
    }

    try {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        client.navigate(client.url);
      }
    } catch (_) {
      // ignore
    }
  })());
});

self.addEventListener('fetch', () => {
  // Intentionally empty.
});
