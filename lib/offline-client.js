// Kolejka zapisów offline w przeglądarce (POM-14): magazyn IndexedDB, wysyłka z limitem czasu i jedna kolejka
// na kartę, związana z zalogowanym użytkownikiem (OfflineQueue w nagłówku ją uruchamia). Logika: lib/offline-queue.js.
// Service worker nie bierze w tym udziału: w aplikacji natywnej jest wyrejestrowany, a Background Sync
// nie działa w Safari ani Firefoksie, więc kolejkę wysyła strona (start, powrót sieci, powrót do karty).
import { createQueue, memoryStorage } from './offline-queue';
import { newRequestId } from './ids';

export const QUEUE_EVENT = 'zielnik:queue';
const DB = 'zielnik-offline';
const STORE = 'queue';
const TIMEOUT_MS = 10000;
const GENERIC = 'Coś poszło nie tak. Spróbuj ponownie.';

// version: bez podania otwiera bieżącą; baza bez magazynu (np. utworzona pustą przez inny kod) dostaje wyższą wersję z magazynem
function openDb(version) {
  return new Promise((resolve, reject) => {
    const r = version ? indexedDB.open(DB, version) : indexedDB.open(DB);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => {
      const db = r.result;
      if (db.objectStoreNames.contains(STORE)) return resolve(db);
      const v = db.version + 1;
      db.close();
      openDb(v).then(resolve, reject);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('blocked'));
  });
}

// IndexedDB z zapasem w pamięci (tryb prywatny, zablokowane dane witryny): wtedy kolejka żyje do zamknięcia karty
async function idbStorage() {
  let db;
  try { db = await openDb(); } catch { return memoryStorage(); }
  // usunięcie bazy (wylogowanie w innej karcie) czeka na zamknięcie otwartych połączeń: oddajemy je od razu
  db.onversionchange = () => db.close();
  const tx = (mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  return {
    all: () => tx('readonly', (s) => s.getAll()),
    put: (i) => tx('readwrite', (s) => s.put(i)),
    del: (id) => tx('readwrite', (s) => s.delete(id)),
    clear: () => tx('readwrite', (s) => s.clear()),
    close: () => db.close(),
  };
}

// Wysyłka z limitem czasu: wyjątek = brak sieci albo zbyt długie czekanie (zapis trafi do kolejki / zostanie w niej).
// Ponowienie jest bezpieczne: usage i purchase mają requestId, a objawy nadpisują cały dzień.
async function sendRaw(url, method, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method, credentials: 'same-origin', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally { clearTimeout(t); }
}

let queue = null;
let store = null;
// zapisy dodane do kolejki w tym życiu strony: tylko ich stan interfejs zmienił od razu, więc tylko je cofa
// (po przeładowaniu strona pokazuje stan z serwera, bez czekających zapisów)
const optimistic = new Set();
export const wasOptimistic = (id) => optimistic.has(id);
let owner = null;
let starting = null;
let timer = null;
let unbind = null;

const emit = (detail) => window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail }));
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

// Jedna wysyłka naraz także między kartami (Web Locks, gdzie są); requestId i tak chroni przed podwójnym zapisem.
async function flush(force = false) {
  const q = queue;
  if (!q || !online()) return;
  clearTimeout(timer);
  const run = () => q.flush({ force });
  const r = navigator.locks?.request ? await navigator.locks.request('zielnik-offline', run) : await run();
  if (q === queue && r?.retryIn > 0) timer = setTimeout(() => flush(), r.retryIn);
}
export const flushQueue = () => flush(true);

// Uruchamia kolejkę dla zalogowanego użytkownika. Zapisy innego konta (zmiana użytkownika na tym urządzeniu)
// usuwa bez wysyłania; od razu próbuje wysłać to, co czeka.
export function startQueue(userId) {
  const uid = Number(userId);
  if (!uid) return Promise.resolve(null);
  if (owner === uid && starting) return starting;
  stopQueue();
  owner = uid;
  starting = (async () => {
    const storage = await idbStorage();
    if (owner !== uid) { storage.close?.(); return null; }
    store = storage;
    const q = createQueue({ storage, send: (i) => sendRaw(i.url, i.method, i.body), userId: uid, onEvent: emit });
    try { await q.init(); } catch { /* uszkodzony magazyn: kolejka pusta */ }
    if (owner !== uid) return null;
    queue = q;
    const wake = () => flush(true);
    const vis = () => { if (document.visibilityState === 'visible') flush(true); };
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', vis);
    unbind = () => { window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', vis); };
    flush(true);
    return q;
  })();
  return starting;
}

function stopQueue() {
  clearTimeout(timer);
  unbind?.();
  unbind = null;
  queue = null;
  owner = null;
  starting = null;
  try { store?.close?.(); } catch {}
  store = null;
}

export const queueState = () => queue?.state() ?? { pending: 0, items: [], sending: null, blocked: null, retryAt: 0 };
export const hasQueued = (pred) => !!queue?.has(pred);
export const removeQueued = async (id) => (queue ? queue.remove(id) : false);

// Wylogowanie i usunięcie konta: czyści kolejkę (dane zdrowotne nie zostają na urządzeniu). Działa też bez
// uruchomionej kolejki (usuwa całą bazę IndexedDB).
export async function clearQueue() {
  const q = queue;
  try { if (q) await q.clear(); } catch {}
  stopQueue(); // zamyka połączenie, inaczej deleteDatabase czekałoby w nieskończoność (wylogowanie bez przeładowania)
  optimistic.clear();
  try {
    await new Promise((resolve) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onsuccess = r.onerror = r.onblocked = () => resolve();
    });
  } catch {}
  emit({ type: 'change', state: queueState() });
}

// Zapis z kolejką: { kind, url, method, body, meta }. Wynik: { data } po zapisie albo { queued: item }, gdy
// nie ma sieci (offline, błąd sieci, przekroczony czas) albo w kolejce czekają wcześniejsze zapisy (kolejność).
// Błąd serwera przy działającej sieci rzuca wyjątek z komunikatem, jak api().
export async function saveOrQueue({ kind, url, method = 'POST', body, meta }) {
  // kolejka startuje asynchronicznie (IndexedDB); gdy nie wstanie w 2 s, zapisujemy bez niej
  const q = starting ? await Promise.race([starting, new Promise((r) => setTimeout(() => r(null), 2000))]).catch(() => null) : null;
  const payload = q ? { ...body, userId: owner } : body;
  const enqueue = async () => {
    const item = await q.add({ id: body.requestId || newRequestId(), kind, url, method, body: { ...payload, at: Date.now() }, meta });
    optimistic.add(item.id);
    flush();
    return { queued: item };
  };
  if (q && (!online() || q.state().pending > 0)) return enqueue();
  let res;
  try { res = await sendRaw(url, method, payload); } catch {
    if (q) return enqueue();
    throw new Error('Brak połączenia z internetem. Spróbuj ponownie.');
  }
  if (res.status >= 200 && res.status < 300) return { data: res.data };
  throw new Error(res.data?.error || GENERIC);
}
