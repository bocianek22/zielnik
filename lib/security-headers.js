// Polityki bezpieczeństwa używane przez middleware.js. Funkcje czyste (bez next/server), żeby dało się je testować w `npm test`.

// CSP stron z nonce: skrypty tylko z tym nonce (Next.js dokleja go do swoich skryptów, layout do skryptu motywu),
// 'strict-dynamic' przenosi zaufanie na skrypty ładowane przez nie (fragmenty JS Next.js).
// style-src 'unsafe-inline': React ustawia atrybuty style, a next/font wstrzykuje style; style nie wykonują kodu.
// img-src data: blob: - podgląd zdjęcia przed wysłaniem (lib/image.js) i awatary w formularzu.
export function buildCsp(nonce, { dev = false } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "media-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

// Losowy nonce (Web Crypto: działa w Edge i w Node)
export function makeNonce() {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Ochrona przed CSRF dla metod zmieniających stan. Ciasteczko sesji ma SameSite=Lax (główna ochrona); to druga warstwa:
// żądanie z innej strony (nagłówek Origin z innym hostem albo Sec-Fetch-Site: cross-site) jest odrzucane.
// Brak obu nagłówków (stare klienty, narzędzia) przepuszczamy: przeglądarki wysyłają Origin przy każdym POST/PUT/DELETE.
// `host` to host, pod którym przyszło żądanie (na Vercel: domena wdrożenia lub własna domena).
export function crossSiteRequest(method, headers, host) {
  if (SAFE_METHODS.has(String(method).toUpperCase())) return false;
  const origin = headers.get('origin');
  if (origin) {
    if (origin === 'null') return true; // sandbox, data:, przekierowania między witrynami
    try { return new URL(origin).host.toLowerCase() !== String(host || '').toLowerCase(); } catch { return true; }
  }
  return headers.get('sec-fetch-site') === 'cross-site';
}
