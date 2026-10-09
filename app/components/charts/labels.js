// Rozkład podpisów osi X (HTML pod wykresem): czyste funkcje, bez Reacta. Szerokość znaku 12 px jest przybliżona (CHAR).
// items: [{ key, text, x, prio? }], x = środek podpisu w jednostkach `width`. Podpisy o wyższym `prio` są układane pierwsze.
// Zwraca podpisy z numerem rzędu (0 = pierwszy) i stroną zakotwiczenia: 'l' (przy lewej krawędzi), 'c' (środek na x), 'r' (przy prawej).
// Podpis, który nie mieści się w żadnym z `rows` rzędów (nachodzi na inny), jest pomijany: ważniejsze zostają.
const CHAR = 6.4, GAP = 10;

export function layoutLabels(items, width, { rows = 3 } = {}) {
  const taken = Array.from({ length: rows }, () => []);
  const placed = [];
  for (const it of [...items].sort((a, b) => (b.prio ?? 0) - (a.prio ?? 0) || a.x - b.x)) {
    const w = it.text.length * CHAR;
    const side = it.x - w / 2 < 0 ? 'l' : it.x + w / 2 > width ? 'r' : 'c';
    const from = side === 'l' ? 0 : side === 'r' ? width - w : it.x - w / 2;
    const row = taken.findIndex((r) => r.every(([a, b]) => from + w + GAP <= a || from >= b + GAP));
    if (row < 0) continue;
    taken[row].push([from, from + w]);
    placed.push({ ...it, row, side });
  }
  return placed.sort((a, b) => a.x - b.x);
}
