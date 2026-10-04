// Identyfikator z adresu (np. /api/strains/abc, /strains/9999999999): błędny daje 0, które nie pasuje do żadnego
// wiersza (404 zamiast błędu SQL 500). Osobny moduł bez next/server, żeby strony mogły go używać.
export const intId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : 0; };
// requestId szybkiego zapisu (POM-02): brak = null (starszy klient), poprawny = napis, błędny = undefined
export const requestId = (v) => (v == null || v === '' ? null : typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : undefined);
// Nowy requestId w przeglądarce. crypto.randomUUID działa tylko w bezpiecznym kontekście (https), więc
// w razie jego braku (stary WebView, http w sieci lokalnej) składamy UUID v4 z getRandomValues.
export function newRequestId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = c?.getRandomValues ? c.getRandomValues(new Uint8Array(16)) : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// Czas zapisu z kolejki offline (POM-14): kiedy naprawdę zużyto lub wykupiono, a nie kiedy wróciła sieć.
// Brak, błąd, przyszłość albo więcej niż 72 h wstecz = null (serwer bierze teraz), żeby zły zegar telefonu
// nie przeniósł wpisu daleko w czasie.
export const CLIENT_AT_MAX_MS = 72 * 3600 * 1000;
export function clientAt(v, now = Date.now()) {
  if (v == null || v === '') return null;
  const t = typeof v === 'number' ? v : Date.parse(String(v));
  if (!Number.isFinite(t) || t > now || now - t > CLIENT_AT_MAX_MS) return null;
  return new Date(t);
}
// Zapis z kolejki wysłany już po zmianie konta na urządzeniu: userId w treści inny niż zalogowany = odrzucamy (409)
export const otherAccount = (body, user) => body?.userId != null && Number(body.userId) !== Number(user.id);
export const OTHER_ACCOUNT_MSG = 'Ten zapis pochodzi z innego konta, więc go nie zapisano.';
