import { createHash } from 'node:crypto';

// Rewizja TREŚCI regulaminu i polityki prywatności. Zmiana tej stałej (po zmianie treści /regulamin lub /prywatnosc) powoduje,
// że każdy zalogowany widzi ekran ponownej akceptacji (konta z inną wersją, także z NULL, czyli sprzed wprowadzenia wersji).
// Do konta i na ekran zgody trafia wersja EFEKTYWNA (legalVersion): rewizja + skrót kontaktu administratora.
export const LEGAL_VERSION = '2026-10-beta1';
export const LEGAL_DATE = '8 października 2026';
export const LEGAL_DRAFT_NOTE = 'Wersja robocza na czas zamkniętej bety — przed otwartą betą do przeglądu przez prawnika.';

// Brak zmiennej = wyraźny znacznik do uzupełnienia przez właściciela (nie zgadujemy danych administratora)
export const TODO = '[DO UZUPEŁNIENIA]';
export function legalContact(env = process.env) {
  return {
    name: (env.LEGAL_ADMIN_NAME || '').trim() || TODO,
    email: (env.LEGAL_CONTACT_EMAIL || '').trim() || TODO,
  };
}

// Czy dokumenty są kompletne: nazwa i kontakt administratora ustawione (bez znaczników do uzupełnienia)
export function legalContactReady(env = process.env) {
  const c = legalContact(env);
  return c.name !== TODO && c.email !== TODO;
}

// Wersja efektywna = rewizja treści + 8 znaków SHA-256 z nazwy i e-maila administratora. Zmiana kontaktu zmienia
// dokument, więc wymaga ponownej akceptacji. Bez kontaktu: stały sufiks „.bez-kontaktu”: nowe konta mogą powstać (beta
// już działa), ale ConsentGate się nie pokazuje, a po ustawieniu kontaktu wszyscy zaakceptują kompletny tekst.
export function legalVersion(env = process.env) {
  if (!legalContactReady(env)) return `${LEGAL_VERSION}.bez-kontaktu`;
  const c = legalContact(env);
  const h = createHash('sha256').update(`${c.name}\n${c.email.toLowerCase()}`).digest('hex').slice(0, 8);
  return `${LEGAL_VERSION}.${h}`;
}

// Czy zapisana wersja zgody jest aktualna
export const consentCurrent = (version, env = process.env) => version === legalVersion(env);
