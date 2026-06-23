/**
 * sw.js — Service Worker: caché offline básico (app shell) + recepción de
 * Web Push. No intercepta llamadas a Supabase/Anthropic/el backend, solo
 * los assets estáticos de la PWA.
 */
const CACHE_NAME = 'kryon-cache-v2';
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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
