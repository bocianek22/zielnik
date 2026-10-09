// Czyste funkcje skali wykresów (bez Reacta i bez Date): testy w tests/charts.test.js.

// Skala liniowa: wartość z przedziału `domain` na współrzędną z przedziału `range`. Pusty przedział (d0 = d1) daje środek zakresu.
export function linear([d0, d1], [r0, r1]) {
  const span = d1 - d0;
  return (v) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
}

// „Ładne” wartości siatki: 0 i kolejne wielokrotności 1 / 2 / 5 × 10ⁿ (n może być ujemne, więc też 0,5 czy 0,2), ostatnia nie mniejsza niż `max`.
// Przy max <= 0 jest tylko [0]. `n` to docelowa liczba przedziałów (wynik ma ich najwyżej o 1-2 więcej).
export function niceTicks(max, n = 3) {
  if (!(max > 0) || !(n > 0)) return [0];
  const raw = max / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const count = Math.ceil(max / step - 1e-9);
  const round = (v) => Number(v.toPrecision(12));
  return Array.from({ length: count + 1 }, (_, i) => round(i * step));
}

// Podział szerokości na `n` równych przedziałów; słupek ma `1 - pad` przedziału i stoi pośrodku. x(i) to lewy brzeg słupka.
export function band(n, width, { pad = 0.2 } = {}) {
  const step = n > 0 ? width / n : 0;
  const bw = step * (1 - pad);
  return { step, bw, x: (i) => i * step + (step - bw) / 2, center: (i) => (i + 0.5) * step };
}

// Słupek z zaokrągloną górą (r px), zakotwiczony do linii bazowej `base`; zaokrąglenie nie przekracza wysokości ani połowy szerokości.
export function barPath(x, w, h, base, r = 4) {
  const rr = Math.max(0, Math.min(r, h, w / 2));
  const y = base - h;
  return `M${x},${base}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${base}Z`;
}

// Średnia krocząca (okno `window`, wyśrodkowana) po wartościach z przerwami (null/undefined). Przerwy zostają przerwami.
// Przy mniej niż `minPoints` wartościach nie wygładza niczego (zwraca kopię), żeby nie pokazywać trendu z dwóch wpisów.
export function smooth(values, window = 3, minPoints = 5) {
  const have = values.filter((v) => v != null).length;
  if (have < minPoints || window < 2) return values.slice();
  const half = Math.floor(window / 2);
  return values.map((v, i) => {
    if (v == null) return null;
    let sum = 0, cnt = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(values.length - 1, i + half); k++) {
      if (values[k] != null) { sum += values[k]; cnt++; }
    }
    return sum / cnt;
  });
}
