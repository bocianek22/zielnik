// Zewnętrzne sprawdzanie dostępności leku w aptekach (gdziepolek.pl).
// Adres wyszukiwarki gdziepolek nie jest publicznie opisany, więc: znana strona produktu (pole `gdziepolek`
// w data/odmiany.json), a gdy jej nie ma, wyszukiwanie ograniczone do gdziepolek.pl w Google
// (prowadzi do stron produktów „…/produkty/<id>/…/apteki”).
export const GDZIEPOLEK_HOME = 'https://www.gdziepolek.pl/';
export const SITE_SEARCH = 'https://www.google.com/search?q=';

// Fraza: nazwa rejestrowa (tak nazywa produkty gdziepolek, np. „Cannabis flos Aurora THC 22%, CBD <1%”),
// a gdy jej nie znamy: producent i nazwa odmiany
export function pharmacySearchUrl({ url, registeredName, producer, name } = {}) {
  if (url && /^https:\/\/www\.gdziepolek\.pl\//.test(url)) return url;
  const q = String(registeredName || [producer, name].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
  return q ? SITE_SEARCH + encodeURIComponent(`site:gdziepolek.pl ${q}`) : GDZIEPOLEK_HOME;
}
