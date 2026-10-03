// Dopasowanie i ranking podpowiedzi wyszukiwania: bez wielkości liter i polskich znaków („zolw” ~ „Żółw”).
// Czysty moduł (bez importów), używany w przeglądarce i w testach.

// „ł” nie rozkłada się w NFD na literę i znak diakrytyczny, więc trzeba je zamienić ręcznie
const EXTRA = { ł: 'l', Ł: 'l', ß: 'ss', æ: 'ae', ø: 'o', đ: 'd' };

function foldChar(c) {
  if (EXTRA[c]) return EXTRA[c];
  return c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Tekst bez wielkości liter i znaków diakrytycznych
export function fold(text) {
  let out = '';
  for (const c of String(text ?? '')) out += foldChar(c);
  return out;
}

// Wersja do wyróżniania: dla każdego znaku złożonego tekstu indeks znaku w oryginale (UTF-16)
export function foldMap(text) {
  const s = String(text ?? '');
  let out = '';
  const map = [];
  let i = 0;
  for (const c of s) {
    const f = foldChar(c);
    for (let k = 0; k < f.length; k++) map.push(i);
    out += f;
    i += c.length;
  }
  map.push(s.length);
  return { folded: out, map };
}

const isWordChar = (c) => /[\p{L}\p{N}]/u.test(c);

// Ocena dopasowania (mniej = lepiej) albo null:
// 0 cały tekst, 1 początek tekstu, 2 początek słowa, 3 w środku słowa.
// Zapytanie z kilku słów: każde słowo musi pasować, liczy się najsłabsze.
export function score(text, query) {
  const t = fold(text);
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const whole = fold(query).trim().replace(/\s+/g, ' ');
  if (t === whole) return 0;
  if (t.startsWith(whole)) return 1;
  let worst = 0;
  for (const w of words) {
    let best = null;
    for (let i = t.indexOf(w); i !== -1; i = t.indexOf(w, i + 1)) {
      const s = i === 0 ? 1 : !isWordChar(t[i - 1]) ? 2 : 3;
      if (best == null || s < best) best = s;
      if (best === 1) break;
    }
    if (best == null) return null;
    worst = Math.max(worst, best);
  }
  return worst;
}

// Fragmenty do wyróżnienia: [{ text, hit }]. Wyróżnia każde słowo zapytania (najpierw na początku słowa).
export function highlight(text, query) {
  const s = String(text ?? '');
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  if (!s || !words.length) return [{ text: s, hit: false }];
  const { folded, map } = foldMap(s);
  const marks = new Array(folded.length).fill(false);
  for (const w of words) {
    let at = -1;
    for (let i = folded.indexOf(w); i !== -1; i = folded.indexOf(w, i + 1)) {
      if (i === 0 || !isWordChar(folded[i - 1])) { at = i; break; }
      if (at === -1) at = i;
    }
    if (at !== -1) for (let k = at; k < at + w.length; k++) marks[k] = true;
  }
  const parts = [];
  for (let k = 0; k < folded.length;) {
    const hit = marks[k];
    let e = k;
    while (e < folded.length && marks[e] === hit) e++;
    const text = s.slice(map[k], map[e]);
    if (text) parts.push({ text, hit });
    k = e;
  }
  return parts.length ? parts : [{ text: s, hit: false }];
}

// Ranking w grupach. groups: [{ key, items: [{ label, extra?: string[], ... }] }].
// Etykieta ma pierwszeństwo przed polami dodatkowymi (np. producent odmiany), które dostają +4.
// Wynik: te same grupy w tej samej kolejności, tylko z pasującymi pozycjami; łącznie najwyżej max,
// w jednej grupie najwyżej perGroup. Remisy: krótsza etykieta, potem alfabetycznie. Przy jednej literze tylko początki słów.
export function rank(groups, query, { max = 8, perGroup = 5 } = {}) {
  const all = [];
  // jedna litera: tylko początki słów, inaczej „z” podpowiadałoby każdą nazwę z „z” w środku
  const worst = fold(query).trim().length === 1 ? 2 : 3;
  groups.forEach((g, gi) => {
    for (const item of g.items) {
      let best = score(item.label, query);
      if (best != null && best > worst) best = null;
      if (best == null) {
        for (const x of item.extra || []) {
          const s = score(x, query);
          if (s != null && s <= worst && (best == null || s + 4 < best)) best = s + 4;
        }
      }
      if (best != null) all.push({ item, gi, s: best });
    }
  });
  all.sort((a, b) => a.s - b.s || a.gi - b.gi || a.item.label.length - b.item.label.length || a.item.label.localeCompare(b.item.label, 'pl'));
  const taken = groups.map(() => []);
  let n = 0;
  for (const r of all) {
    if (n >= max) break;
    if (taken[r.gi].length >= perGroup) continue;
    taken[r.gi].push(r.item);
    n++;
  }
  return groups.map((g, gi) => ({ ...g, items: taken[gi] })).filter((g) => g.items.length);
}

// Prosty filtr „zawiera” bez polskich znaków (lista odmian, strona wyników)
export function matches(text, query) {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const t = fold(text);
  return words.every((w) => t.includes(w));
}

// Ostatnie wyszukiwania: nowe na początku, bez powtórzeń (bez wielkości liter i znaków), najwyżej limit
export function pushRecent(list, query, limit = 6) {
  const q = String(query ?? '').trim().slice(0, 60);
  if (!q) return list;
  const k = fold(q);
  return [q, ...list.filter((x) => fold(x) !== k)].slice(0, limit);
}
