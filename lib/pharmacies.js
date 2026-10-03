// Zewnętrzne wyszukiwanie dostępności leku w aptekach (gdziepolek.pl).
// Adresu wyszukiwarki nie udało się potwierdzić automatycznie (serwis blokuje pobieranie stron z naszego
// środowiska); gdyby serwis go zmienił, wystarczy poprawić tę stałą.
export const GDZIEPOLEK_HOME = 'https://www.gdziepolek.pl/';
export const GDZIEPOLEK_SEARCH = 'https://www.gdziepolek.pl/szukaj?q=';

// Fraza: nazwa rejestrowa (tak nazywa produkty gdziepolek, np. „Cannabis flos Aurora THC 22%, CBD <1%”),
// a gdy jej nie znamy: producent i nazwa odmiany
export function pharmacySearchUrl({ registeredName, producer, name } = {}) {
  const q = String(registeredName || [producer, name].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
  return q ? GDZIEPOLEK_SEARCH + encodeURIComponent(q) : GDZIEPOLEK_HOME;
}
