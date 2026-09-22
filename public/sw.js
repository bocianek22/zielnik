// Service worker: cache tylko "powłoki" aplikacji (statyczne pliki), nigdy odpowiedzi API ani stron z danymi.
// Dzięki temu strona otwiera się szybciej i działa offline z komunikatem, ale dane zawsze są świeże z sieci.
const CACHE = 'zielnik-shell-v1';
const SHELL = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/offline.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // nigdy nie cachujemy API ani danych
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }
  if (SHELL.some((p) => url.pathname === p)) {
    e.respondWith(caches.match(request).then((c) => c || fetch(request)));
  }
});
