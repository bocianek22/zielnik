// Formaty wydruków w dwóch językach (karta terapii i raport skrócony po angielsku, POM-64). Daty słownie, bez
// niejednoznacznych zapisów liczbowych; dzień „RRRR-MM-DD” w czasie polskim.
export const PRINT_LANGS = ['pl', 'en'];
export const printLang = (v) => (PRINT_LANGS.includes(v) ? v : 'pl');
const LOCALE = { pl: 'pl-PL', en: 'en-GB' };
const OPTS = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' };

export const printDay = (iso, lang) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString(LOCALE[printLang(lang)], OPTS);
export const printNum = (n, lang, max = 1) => Number(n).toLocaleString(LOCALE[printLang(lang)], { maximumFractionDigits: max });
