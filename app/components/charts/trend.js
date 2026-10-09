// Trend objawu z okna 7 dni (czyste funkcje, testy w tests/charts-trend.test.js).

// Dla każdego dnia z wpisem: średnia, minimum i maksimum z okna `win` dni kończącego się tego dnia (bez zaglądania w przyszłość).
// Okno z mniej niż `min` wpisami daje null, więc przy rzadkich wpisach nie ma ani linii, ani pasma. Dni bez wpisu też dają null.
export function rolling(values, win = 7, min = 4) {
  return values.map((v, i) => {
    if (v == null) return null;
    const w = values.slice(Math.max(0, i - win + 1), i + 1).filter((x) => x != null);
    if (w.length < min) return null;
    return { mean: w.reduce((a, x) => a + x, 0) / w.length, lo: Math.min(...w), hi: Math.max(...w), n: w.length };
  });
}

// Odcinki linii: kolejne dni z wartością łączą się tylko wtedy, gdy dzieli je najwyżej `maxGap` dni (dłuższa przerwa ją rwie).
// items: tablica z null dla brakujących dni; zwraca [[{ i, ...item }, ...], ...].
export function segments(items, maxGap = 3) {
  const out = [];
  let cur = [], prev = -Infinity;
  items.forEach((it, i) => {
    if (it == null) return;
    if (cur.length && i - prev > maxGap) { out.push(cur); cur = []; }
    cur.push({ i, ...it });
    prev = i;
  });
  if (cur.length) out.push(cur);
  return out;
}
