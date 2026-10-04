// Kolejka zapisów offline (POM-14): „Zużyłem”, „Wykupiłem” i szybki wpis objawów zapisane bez sieci
// czekają na urządzeniu i wysyłają się po jej powrocie, po kolei. Czysty moduł bez przeglądarki:
// magazyn (IndexedDB albo atrapa w testach) i wysyłka są wstrzykiwane, czas też.
//
// storage: { all(): Promise<item[]>, put(item), del(id), clear() }
// send(item): Promise<{ status, data }>; wyjątek = brak sieci albo przekroczony czas (ponowimy)
// Pozycja: { id, seq, userId, kind: 'usage' | 'purchase' | 'symptoms', url, method, body, meta, createdAt, attempts }

export const RETRY_BASE_MS = 5000;
export const RETRY_MAX_MS = 5 * 60 * 1000;
export const KINDS = ['usage', 'purchase', 'symptoms'];

// Co zrobić z odpowiedzią serwera:
// ok: wysłano; retry: chwilowy błąd (sieć, 5xx, 408, 425, 429) - zostaje i ponawiamy z rosnącą przerwą;
// auth: sesja wygasła lub trzeba zmienić hasło (401, 403) - zostaje, czekamy na zalogowanie, nie kasujemy danych;
// reject: inny błąd 4xx (np. odmiana usunięta, zapis z innego konta: 409) - usuwamy i pokazujemy komunikat.
export function classify(status) {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401 || status === 403) return 'auth';
  if (status === 408 || status === 425 || status === 429 || status >= 500 || !status) return 'retry';
  return 'reject';
}

// przerwa przed kolejną próbą: 5 s, 10 s, 20 s… do 5 minut
export const backoff = (attempts) => Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS);

const bySeq = (a, b) => a.seq - b.seq;

export function createQueue({ storage, send, userId, now = Date.now, onEvent = () => {} }) {
  let items = [];
  let inFlight = null;
  let flushing = null;
  let blocked = null; // 'auth' | null
  let retryAt = 0;
  const uid = Number(userId);

  const emit = (e) => { try { onEvent(e); } catch { /* błąd słuchacza nie zatrzymuje kolejki */ } };
  const changed = () => emit({ type: 'change', state: state() });

  // Wczytuje kolejkę z magazynu; pozycje innego konta (zmiana użytkownika na tym urządzeniu) są usuwane bez wysyłania.
  async function load() {
    const all = await storage.all();
    const foreign = all.filter((i) => Number(i.userId) !== uid);
    for (const i of foreign) await storage.del(i.id);
    items = all.filter((i) => Number(i.userId) === uid).sort(bySeq);
    return foreign.length;
  }

  function state() {
    return { pending: items.length, items: items.slice(), sending: inFlight, blocked, retryAt };
  }

  async function init() {
    const dropped = await load();
    changed();
    return dropped;
  }

  // Dopisuje zapis na koniec kolejki. Objawy jednego dnia nadpisują się w całości (PUT zapisuje cały wiersz),
  // więc nowszy wpis tego dnia zastępuje czekający (o ile nie jest właśnie wysyłany).
  async function add(entry) {
    if (!KINDS.includes(entry.kind)) throw new Error('Nieznany rodzaj zapisu.');
    if (entry.kind === 'symptoms') {
      for (const old of items.filter((i) => i.kind === 'symptoms' && i.meta?.day === entry.meta?.day && i.id !== inFlight)) {
        await storage.del(old.id);
        items = items.filter((i) => i.id !== old.id);
      }
    }
    const seq = Math.max(0, ...items.map((i) => i.seq)) + 1;
    const item = { ...entry, seq, userId: uid, createdAt: entry.createdAt ?? now(), attempts: 0 };
    await storage.put(item);
    items = [...items, item].sort(bySeq);
    changed();
    return item;
  }

  // „Cofnij” / „Usuń” dla czekającego zapisu. Pozycji, która właśnie leci do serwera, nie usuwamy (false):
  // serwer mógł ją już zapisać.
  async function remove(id) {
    if (id === inFlight) return false;
    const item = items.find((i) => i.id === id);
    if (!item) return false;
    await storage.del(id);
    items = items.filter((i) => i.id !== id);
    emit({ type: 'removed', item });
    changed();
    return true;
  }

  async function clear() {
    await storage.clear();
    items = [];
    blocked = null;
    retryAt = 0;
    changed();
  }

  // Wysyła kolejkę po kolei. Pierwsza pozycja z chwilowym błędem zatrzymuje całą kolejkę (zachowujemy kolejność),
  // a wynik mówi, za ile ponowić. Jedno wysyłanie naraz; drugie wywołanie czeka na pierwsze.
  async function flush({ force = false } = {}) {
    if (flushing) return flushing;
    flushing = (async () => {
      let sent = 0, rejected = 0;
      try {
        await load(); // inna karta mogła już coś wysłać albo dopisać
        if (!force && retryAt > now()) return { sent, rejected, retryIn: retryAt - now() };
        blocked = null;
        retryAt = 0;
        while (items.length) {
          const item = items[0];
          inFlight = item.id;
          changed();
          let res = null;
          try { res = await send(item); } catch { res = null; }
          inFlight = null;
          const verdict = res ? classify(res.status) : 'retry';
          if (verdict === 'ok') {
            await storage.del(item.id);
            items = items.filter((i) => i.id !== item.id);
            sent++;
            emit({ type: 'sent', item, data: res.data });
            continue;
          }
          if (verdict === 'reject') {
            await storage.del(item.id);
            items = items.filter((i) => i.id !== item.id);
            rejected++;
            emit({ type: 'rejected', item, status: res.status, message: res.data?.error || 'Serwer odrzucił zapis.' });
            continue;
          }
          if (verdict === 'auth') {
            blocked = 'auth';
            return { sent, rejected, blocked };
          }
          const upd = { ...item, attempts: (item.attempts || 0) + 1 };
          await storage.put(upd);
          items = items.map((i) => (i.id === item.id ? upd : i));
          retryAt = now() + backoff(upd.attempts);
          return { sent, rejected, retryIn: retryAt - now() };
        }
        return { sent, rejected };
      } finally {
        inFlight = null;
        flushing = null;
        changed();
      }
    })();
    return flushing;
  }

  return { init, add, remove, clear, flush, state, has: (pred) => items.some(pred) };
}

// Magazyn w pamięci: testy i zapas, gdy IndexedDB nie działa (tryb prywatny, zablokowane dane witryny)
export function memoryStorage(initial = []) {
  const m = new Map(initial.map((i) => [i.id, structuredClone(i)]));
  return {
    all: async () => [...m.values()].map((i) => structuredClone(i)),
    put: async (i) => { m.set(i.id, structuredClone(i)); },
    del: async (id) => { m.delete(id); },
    clear: async () => { m.clear(); },
    size: () => m.size,
  };
}

// Etykieta pozycji w panelu kolejki. W trybie dyskretnym bez nazwy odmiany (rozmycie .dn odsłania się dotknięciem,
// więc nazwy w ogóle nie pokazujemy).
const pl = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',');
export function itemLabel(item, discreet = false) {
  const m = item.meta || {};
  if (item.kind === 'symptoms') return `Objawy z ${String(m.day || '').slice(8, 10)}.${String(m.day || '').slice(5, 7)}`;
  const what = item.kind === 'usage' ? `Zużycie −${pl(m.grams)} ${m.unit || 'g'}` : `Wykup +${pl(m.grams)} ${m.unit || 'g'}`;
  return !discreet && m.name ? `${what}, ${m.name}` : what;
}

// „1 zapis czeka na wysłanie”, „2 zapisy czekają…”, „5 zapisów czeka…”
export function pendingText(n) {
  const last = n % 10, last2 = n % 100;
  const few = last >= 2 && last <= 4 && (last2 < 12 || last2 > 14);
  const word = n === 1 ? 'zapis' : few ? 'zapisy' : 'zapisów';
  return `${n} ${word} ${few ? 'czekają' : 'czeka'} na wysłanie`;
}

// Cofnięcie stanu pokazanego od razu dla zapisu, który nie trafi na serwer (usunięty z kolejki albo odrzucony).
// meta.delta: o ile zmieniono „Mam teraz”, meta.poolDelta: o ile zmniejszono pulę „Do wykupienia”.
// Wynik: zmiana stanu i puli oraz ujemne used/bought dla wykresu i sum (jak „Cofnij” z serwera).
export function revertOf(item) {
  const m = item.meta || {};
  const g = Number(m.grams) || 0;
  if (item.kind === 'usage') return { dCur: Number(m.delta ?? g) || 0, dRem: 0, used: -g };
  if (item.kind === 'purchase') return { dCur: -(Number(m.delta ?? g) || 0), dRem: Number(m.poolDelta) || 0, bought: -g };
  return null;
}
