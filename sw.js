self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

/* ---- Push real (Web Push + VAPID) ----
   El payload lo arma la Edge Function "enviar-push-urgentes": {titulo, mensaje, url}. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const titulo = data.titulo || 'Parents Break';
  const opciones = {
    body: data.mensaje || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: data.id || (titulo + Date.now()),
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientsList) {
      if ('focus' in c) {
        if ('navigate' in c) { try { await c.navigate(url); } catch (e) {} }
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
