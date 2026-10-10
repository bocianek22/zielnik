// Service worker: cache tylko "powłoki" aplikacji (statyczne pliki), nigdy odpowiedzi API ani stron z danymi.
// Dzięki temu strona otwiera się szybciej i działa offline z komunikatem, ale dane zawsze są świeże z sieci.
const CACHE = 'zielnik-shell-v2';
// czcionki PDF raportu: plik powstaje lokalnie, także bez sieci
const SHELL = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/offline.html', '/fonts/Figtree-Regular.ttf', '/fonts/Figtree-Bold.ttf'];

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

// Przypomnienia push (PAC-3). Treść przygotowuje serwer (domyślnie bez szczegółów, bo widać ją na ekranie blokady).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Zielnik', {
    body: d.body || 'Masz nowe przypomnienie.',
    icon: '/icon-192.png',
    tag: d.tag || 'zielnik',
    renotify: true,
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let path = '/';
  try {
    const u = new URL(e.notification.data?.url || '/', location.origin);
    if (u.origin === location.origin) path = u.pathname + u.search;
  } catch {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
    const win = list.find((c) => new URL(c.url).origin === location.origin);
    if (win) {
      await win.focus();
      if ('navigate' in win) return win.navigate(path).catch(() => {});
      return;
    }
    return self.clients.openWindow(path);
  }));
});

// Przeglądarka odnowiła subskrypcję: zapisujemy nową (z ciasteczkiem sesji); stara zniknie przy pierwszym 410.
self.addEventListener('pushsubscriptionchange', (e) => {
  const key = e.oldSubscription?.options?.applicationServerKey;
  if (!key) return;
  e.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    .then((sub) => fetch('/api/push/subscription', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }),
    }))
    .catch(() => {}));
});
