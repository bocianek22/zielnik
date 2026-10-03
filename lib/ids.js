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
