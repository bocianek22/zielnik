// Pozycje podpowiedzi wyszukiwania (dla SearchSuggest) z danych, które przeglądarka już ma.
// Czysty moduł (zależy tylko od searchMatch), działa w przeglądarce i w testach.
import { fold } from './searchMatch.js';

const odmian = (n) => (n === 1 ? 'odmiana' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'odmiany' : 'odmian');
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

// Odmiany: nazwa, a jako pole dodatkowe producent (także „nazwa producent” na zapytania z dwóch słów)
export const strainItems = (strains) => strains.map((s) => ({
  key: `s${s.id}`, type: 'strain', id: s.id, label: s.name, extra: [s.producer, `${s.name} ${s.producer}`], sub: s.producer, dn: true, subDn: true,
}));

export const catalogItems = (catalog) => catalog.map((c) => ({
  key: `c${c.id}`, type: 'catalog', id: c.id, label: c.name, extra: [c.producer, `${c.name} ${c.producer}`], sub: c.producer, dn: true, subDn: true,
}));

// Producenci z odmian (z liczbą odmian) i z katalogu, bez powtórzeń
export function producerItems(strains, catalog = []) {
  const m = new Map();
  for (const s of strains) {
    if (!s.producer) continue;
    const k = fold(s.producer);
    const e = m.get(k) || { name: s.producer, n: 0 };
    e.n += 1;
    m.set(k, e);
  }
  for (const c of catalog) {
    const k = fold(c.producer);
    if (c.producer && !m.has(k)) m.set(k, { name: c.producer, n: 0 });
  }
  return [...m.entries()].map(([k, e]) => ({
    key: `p${k}`, type: 'producer', label: e.name, dn: true, sub: e.n ? `${e.n} ${odmian(e.n)}` : 'w katalogu',
  }));
}

// Terpeny (z odmian i opcjonalnie z Wiedzy) oraz smaki (pole „smak” odmian, rozdzielane przecinkami)
export function flavorItems(strains, known = []) {
  const m = new Map();
  const add = (name, kind) => {
    const v = String(name || '').trim();
    if (!v || v.length > 40) return;
    const k = fold(v);
    if (!m.has(k)) m.set(k, { label: cap(v), kind });
  };
  for (const s of strains) for (const t of s.terpenes || []) add(t, 'Terpen');
  for (const t of known) add(t, 'Terpen');
  for (const s of strains) for (const t of String(s.taste || '').split(/[,;/]/)) add(t, 'Smak');
  return [...m.entries()].map(([k, e]) => ({ key: `f${k}`, type: 'flavor', label: e.label, sub: e.kind }));
}

export const articleItems = (articles) => articles.map((a) => ({ key: `a${a.id}`, type: 'article', id: a.id, label: a.title }));

export const groupItems = (groups) => groups.map((g) => ({ key: `g${g.id}`, type: 'group', id: g.id, label: g.name }));

export const personItems = (users) => users.map((u) => ({
  key: `u${u.username}`, type: 'person', username: u.username, label: u.display_name || u.username, extra: [u.username], sub: `@${u.username}`,
}));
