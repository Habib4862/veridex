/**
 * sw.js — Service Worker: caché offline básico (app shell) + recepción de
 * Web Push. No intercepta llamadas a Supabase/Anthropic/el backend, solo
 * los assets estáticos de la PWA.
 *
 * CACHE_NAME debe subir de versión en cada despliegue que toque algún
 * archivo de ASSETS: si no, una instancia ya instalada (escritorio/móvil)
 * sigue sirviendo el código viejo de su caché aunque Vercel ya tenga el
 * nuevo. Al activarse una versión nueva, avisa a las pestañas abiertas para
 * que se recarguen solas y queden al día sin que el usuario tenga que saberlo.
 */
const CACHE_NAME = 'kryon-cache-v11';
const ASSETS = [
  './index.html',
  './css/style.css',
  './js/brain.js',
  './js/supabase.js',
  './js/connections.js',
  './js/agents.js',
  './js/healer.js',
  './js/pipeline.js',
  './js/claude.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  // fetch con cache:'reload' para no rellenar la caché nueva con respuestas
  // viejas que sigan en la caché HTTP del navegador.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(ASSETS.map((url) => fetch(url, { cache: 'reload' }).then((res) => cache.put(url, res)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((client) => client.postMessage({ type: 'KRYON_UPDATED' })))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // no cachear APIs externas
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => caches.match('./index.html')))
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'AXIOM CORE', body: 'Tienes una actualización en KRYON' };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body }));
});
