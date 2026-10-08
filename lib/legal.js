// Wersja regulaminu i polityki prywatności. Zmiana tej stałej (po zmianie treści /regulamin lub /prywatnosc) powoduje,
// że każdy zalogowany widzi ekran ponownej akceptacji (konta z inną wersją, także z NULL, czyli sprzed wprowadzenia wersji).
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

// Czy zapisana wersja zgody jest aktualna
export const consentCurrent = (version) => version === LEGAL_VERSION;
