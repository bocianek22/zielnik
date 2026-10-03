// Jednostki ilości: susz liczymy w gramach, olej i wkład do pena w mililitrach.
// Kolumny i pola API nadal nazywają się `grams` / `price_per_g` (zgodność wstecz); jednostkę wyznacza postać odmiany.
// Ta sama reguła jest w SQL: form_unit() i strain_unit() w lib/db.js.

export const UNITS = ['g', 'ml'];
export const unitOf = (form) => (form === 'olej' || form === 'pen' ? 'ml' : 'g');
export const normUnit = (u) => (u === 'ml' ? 'ml' : 'g');

// 0,5 / 12 / 1,25 (najwyżej `max` miejsc po przecinku, bez separatora tysięcy, więc wynik jest ten sam na serwerze i w telefonie)
export function fmtNum(n, max = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '–';
  const p = 10 ** max;
  return String(Math.round(x * p) / p).replace('.', ',');
}
// "0,5 ml", "12 g"
export const fmtQty = (n, unit = 'g', max = 2) => `${fmtNum(n, max)} ${normUnit(unit)}`;
// "zł/g" albo "zł/ml"
export const priceUnit = (unit) => `zł/${normUnit(unit)}`;
// "gramów" / "mililitrów" (pytania „Ile … zużyłeś?”)
export const unitGen = (unit) => (normUnit(unit) === 'ml' ? 'mililitrów' : 'gramów');

// Szybkie wartości. Olej: butelki 10 i 30 ml (np. Cannabis extractum normatum 30 ml), dawki w dziesiątych częściach ml.
// Pen: wkład / strzykawka 0,45 lub 0,9 ml ekstraktu (ok. 0,5 i 1 g), więc dawki i wykup są dużo mniejsze.
const QUICK = {
  susz: { use: [0.1, 0.25, 0.5, 1], buy: [5, 10, 15] },
  olej: { use: [0.1, 0.25, 0.5, 1], buy: [10, 30, 60] },
  pen: { use: [0.05, 0.1, 0.25, 0.5], buy: [0.45, 0.9, 1.8] },
};
export const quickValues = (form) => QUICK[form] || QUICK.susz;
// przykład w polu tekstowym
export const consumePlaceholder = (form) => (form === 'pen' ? 'np. 0,1' : 'np. 0,5');
export const buyPlaceholder = (form) => (form === 'pen' ? 'np. 0,9' : form === 'olej' ? 'np. 30' : 'np. 10');

// Podpowiedź postaci po nazwie w formularzu nowej odmiany (bez wymuszania): „Extractum …” i „Cannabis extractum
// normatum …” to ekstrakty olejowe z apteki
export function suggestForm(name) {
  const t = String(name || '').trim().toLowerCase();
  return /^extractum\b|\bextractum normatum\b/.test(t) ? 'olej' : null;
}

// Sumy osobno dla jednostek: rows [{ unit, value }] -> { g, ml }
export function sumByUnit(rows, key = 'grams') {
  const out = { g: 0, ml: 0 };
  for (const r of rows || []) out[normUnit(r.unit)] += Number(r[key]) || 0;
  return out;
}
