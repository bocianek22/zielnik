// Wykres własnych pomiarów (POM-63): czysta część (oś Y, punkty), bez Reacta; testy w tests/measure-chart.test.js.
// Pomiary takie jak waga czy tętno nie zaczynają się od zera, więc skala obejmuje tylko zakres wartości z marginesem,
// zaokrąglony do „ładnego” kroku (1 / 2 / 5 × 10ⁿ). Jedna seria na wykres: różne jednostki nigdy na wspólnej osi.

function step(span, n) {
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}
const round = (v) => Number(v.toPrecision(12));

// values: liczby -> { lo, hi, ticks } (ticks rosnąco, lo = ticks[0], hi = ticks.at(-1)); pusta lista -> null
export function measureScale(values, n = 3) {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  let min = Math.min(...v), max = Math.max(...v);
  // jedna wartość albo same równe: przedział wokół niej (±5% albo ±1), żeby linia stała w środku
  if (min === max) { const d = Math.abs(min) * 0.05 || 1; min -= d; max += d; }
  const s = step(max - min, n);
  const lo = round(Math.floor(min / s - 1e-9) * s), hi = round(Math.ceil(max / s - 1e-9) * s);
  const ticks = [];
  for (let t = lo; t <= hi + s / 2; t += s) ticks.push(round(t));
  return { lo, hi: ticks.at(-1), ticks };
}

// Punkty serii na osi `days` (lista dni ISO, najstarszy pierwszy): [{ i, day, value }] dla dni z wartością
export function measurePoints(days, values, id) {
  const by = new Map(values.filter((r) => r.id === id).map((r) => [r.day, r.value]));
  return days.flatMap((day, i) => (by.has(day) ? [{ i, day, value: by.get(day) }] : []));
}
