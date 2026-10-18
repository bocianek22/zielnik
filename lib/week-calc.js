// UI 5 etap 5: podsumowanie tygodnia (czysta część; SQL w lib/week-summary.js). Tylko objawy, nigdy zużycie.
// Ostatnie 7 dni (z dziś) kontra 7 dni wcześniej. Zmianę pokazujemy dopiero, gdy oba tygodnie mają po co najmniej
// MIN_N wpisów danego objawu: ze średniej z jednego dnia nie da się nic wywnioskować.
import { SYMPTOMS } from './symptoms.js';

export const MIN_N = 3;
const r1 = (x) => Math.round(x * 10) / 10;

// row: { <key>_c, <key>_cn, <key>_p, <key>_pn } z SQL -> [{ key, label, avg, n, diff, better }]
// diff: zmiana zaokrąglona do 0,1 (null bez porównania), better: true/false (null przy braku zmiany lub porównania)
export function weekTrends(row) {
  return SYMPTOMS.map((s) => {
    const n = Number(row?.[`${s.key}_cn`]) || 0, pn = Number(row?.[`${s.key}_pn`]) || 0;
    const avg = n > 0 ? r1(Number(row[`${s.key}_c`])) : null;
    // różnica zaokrąglonych średnich: zgadza się z liczbami, które widzi użytkownik (3,3 wobec 4,0 to 0,7)
    const diff = n >= MIN_N && pn >= MIN_N ? r1(avg - r1(Number(row[`${s.key}_p`]))) : null;
    const better = diff == null || diff === 0 ? null : (diff > 0) === s.higherBetter;
    return { key: s.key, label: s.label, avg, n, diff, better };
  });
}
