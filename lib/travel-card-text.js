import { normUnit } from './units.js';

// Teksty wydruku karty terapii (POM-58, wersja angielska POM-64). Tłumaczenie dosłowne, bez nowych stwierdzeń o prawie;
// dane (pacjent, nazwy odmian i producentów) zostają bez tłumaczenia. Oba języki mają te same klucze (test jednostkowy).
// Teksty listy „Przed wyjazdem” w obu językach są na liście do przejrzenia przez prawnika (docs/HANDOFF.md).
export const CARD_LANGS = ['pl', 'en'];
export const cardLang = (v) => (CARD_LANGS.includes(v) ? v : 'pl');

export const CARD_TEXT = {
  pl: {
    title: 'Zestawienie: recepty i zapas',
    patient: 'Pacjent',
    asOf: 'Stan na',
    rxHead: 'Recepty (według zapisów)',
    rxNone: 'Brak zapisanych recept z terminem od dziś.',
    rxRegion: 'Recepty',
    rxCaption: 'Recepty: data wystawienia, termin zapisany przez pacjenta, ilość przepisana',
    issued: 'Wystawiona',
    term: 'Termin',
    prescribed: 'Przepisano',
    until: (d) => `do ${d}`,
    noTerm: 'termin nie zapisany',
    stockHead: 'Zapas (według zapisów w aplikacji)',
    stockNone: 'Brak zapisanego zapasu.',
    checkHead: 'Przed wyjazdem',
    check: [
      'Oryginalne opakowania z apteki, z etykietą.',
      'Recepta albo jej wydruk (kod e-recepty) i ta karta.',
      'Zabierz tyle, ile potrzebujesz na czas wyjazdu.',
      'Wyjazd za granicę: sprawdź przepisy kraju docelowego i krajów tranzytowych oraz zasady przewoźnika, najlepiej w oficjalnych źródłach (ambasada, przewoźnik).',
    ],
    note: 'Lista przypominająca, nie porada prawna. Zestawienie powstało z zapisów prowadzonych przez pacjenta w aplikacji.',
  },
  en: {
    title: 'Summary: prescriptions and supply',
    patient: 'Patient',
    asOf: 'As of',
    rxHead: 'Prescriptions (as recorded)',
    rxNone: 'No recorded prescriptions valid from today.',
    rxRegion: 'Prescriptions',
    rxCaption: 'Prescriptions: date issued, expiry recorded by the patient, amount prescribed',
    issued: 'Issued',
    term: 'Valid',
    prescribed: 'Prescribed',
    until: (d) => `until ${d}`,
    noTerm: 'expiry not recorded',
    stockHead: 'Supply (as recorded in the app)',
    stockNone: 'No supply recorded.',
    checkHead: 'Before you travel',
    check: [
      'Original pharmacy packaging, with the label.',
      'The prescription or a printout of it (e-prescription code) and this card.',
      'Take as much as you need for the duration of the trip.',
      'Travelling abroad: check the rules of the destination and transit countries and the carrier’s policy, preferably in official sources (embassy, carrier).',
    ],
    note: 'A reminder list, not legal advice. This summary was made from records kept by the patient in the app.',
  },
};

const OPTS = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' };
const LOCALE = { pl: 'pl-PL', en: 'en-GB' };
// Dzień „RRRR-MM-DD” (czas polski) jako „8 października 2026” albo „8 October 2026” (bez niejednoznacznych dat liczbowych)
export const cardDay = (iso, lang) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString(LOCALE[cardLang(lang)], OPTS);
// Ilość z jednostką: „4,5 g” albo „4.5 g”
export const cardQty = (n, unit, lang) => `${Number(n).toLocaleString(LOCALE[cardLang(lang)], { maximumFractionDigits: 2 })} ${normUnit(unit)}`;
