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
    data: { url: data.url || './' },
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Resuelto siempre contra el scope real del service worker (el subpath del repo en
  // GitHub Pages) — un path que empiece con "/" a secas apuntaría a la raíz de github.io,
  // que no existe, y tiraba 404 (bug encontrado probando en vivo).
  const rutaCruda = (event.notification.data && event.notification.data.url) || './';
  const url = new URL(rutaCruda, self.registration.scope).href;
  // Siempre abre una ventana nueva — NO intenta reusar/navegar una pestaña ya abierta.
  // Antes probaba reciclar una pestaña existente, y una vez agarró una pestaña vieja que
  // no era la app (tenía el código de sw.js abierto en texto plano) y se quedó ahí en vez
  // de llevar a la app — bug encontrado probando en vivo.
  event.waitUntil(self.clients.openWindow(url));
});
