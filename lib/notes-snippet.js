import { foldMap, fold } from './searchMatch.js';

// Czysta część POM-17 (lib/notes-search.js): wycinek trafienia w notatce.
const SNIPPET = 90;

// Wycinek ~SNIPPET znaków wokół pierwszego trafienia (bez polskich znaków i wielkości liter, jak podpowiedzi).
// Zwraca { before, hit, after } albo null, gdy tekst nie zawiera wszystkich słów zapytania.
export function snippet(text, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const { folded, map } = foldMap(text);
  if (!words.every((w) => folded.includes(w))) return null;
  const at = folded.indexOf(words[0]);
  const s = map[at], e = map[at + words[0].length];
  const room = Math.max(0, SNIPPET - (e - s));
  let from = Math.max(0, s - Math.floor(room / 3));
  let to = Math.min(text.length, e + room - (s - from));
  from = Math.max(0, Math.min(from, to - SNIPPET));
  const clip = (t) => t.replace(/\s+/g, ' ');
  return {
    before: (from > 0 ? '…' : '') + clip(text.slice(from, s)),
    hit: text.slice(s, e),
    after: clip(text.slice(e, to)) + (to < text.length ? '…' : ''),
  };
}
