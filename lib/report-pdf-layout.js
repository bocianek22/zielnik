// Układ raportu dla lekarza w PDF (POM-40): czyste funkcje bez pdf-lib i bez DOM, sprawdzane w tests/report-pdf.test.js.
// Wejście: lista bloków (lib/report-pdf-model.js) i funkcja `measure(tekst, rozmiar, pogrubiony)` zwracająca szerokość w pt.
// Wyjście: strony, a na nich proste operacje rysowania (tekst, linia) we współrzędnych od lewego górnego rogu strony.

export const PAGE = { w: 595.28, h: 841.89, mx: 42, top: 64, bottom: 54 }; // A4 w punktach
export const CONTENT_W = PAGE.w - 2 * PAGE.mx;
const LH = 1.32; // interlinia
const PAD_X = 4;
const PAD_Y = 3;
const GRAY = { text: 0, muted: 0.35, rule: 0.55, hair: 0.8 };

const STYLES = {
  title: { size: 16, bold: true, after: 6 },
  p: { size: 9.5, after: 6 },
  small: { size: 8, muted: true, after: 6 },
  h3: { size: 11.5, bold: true, before: 10, after: 4 },
  list: { size: 9.5, after: 6 },
};

// Zawijanie po spacjach; słowo dłuższe niż linia jest łamane w dowolnym miejscu. \n wymusza nową linię.
export function wrapText(text, maxW, measure, size, bold = false) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/ +/)) {
      if (!word) continue;
      const tryLine = line ? `${line} ${word}` : word;
      if (measure(tryLine, size, bold) <= maxW) { line = tryLine; continue; }
      if (line) { out.push(line); line = ''; }
      if (measure(word, size, bold) <= maxW) { line = word; continue; }
      let chunk = '';
      for (const ch of word) { // for..of: nie rozcina par zastępczych
        if (chunk && measure(chunk + ch, size, bold) > maxW) { out.push(chunk); chunk = ch; } else chunk += ch;
      }
      line = chunk;
    }
    out.push(line);
  }
  return out;
}

// Szerokości kolumn: wagi -> punkty, suma = szerokość treści
export function columnWidths(weights, total = CONTENT_W) {
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * total);
}

export function layoutReport(blocks, { measure, clean = (s) => s }) {
  const pages = [[]];
  let y = PAGE.top;
  const limit = PAGE.h - PAGE.bottom;
  const ops = () => pages[pages.length - 1];
  const newPage = () => { pages.push([]); y = PAGE.top; };
  const need = (h) => { if (y + h > limit && y > PAGE.top) newPage(); };
  const lineH = (size) => size * LH;

  const text = (t, x, size, { bold = false, gray = GRAY.text, align = 'left', w = 0 } = {}) => {
    const tw = align === 'right' ? measure(t, size, bold) : 0;
    ops().push({ t: 'text', x: align === 'right' ? x + w - tw : x, y: y + size, text: t, size, bold, gray });
  };
  const rule = (yy, gray, width) => ops().push({ t: 'line', x1: PAGE.mx, x2: PAGE.w - PAGE.mx, y: yy, gray, width });

  // wysokość pierwszego fragmentu bloku: nagłówek nie zostaje sam na dole strony
  const firstChunk = (b) => {
    if (!b) return 0;
    if (b.type === 'table') return tableHeadH(b) + (b.rows.length ? rowH(b, b.rows[0]) : 0);
    const st = STYLES[b.type] || STYLES.p;
    return lineH(st.size) * 2;
  };

  const widthsOf = (b) => columnWidths(b.widths || b.head.map(() => 1));
  // komórka nie może być wyższa niż ok. 60% strony (wiersza się nie dzieli): dłuższa kończy się jawnym znacznikiem
  const maxLines = (size) => Math.floor(((limit - PAGE.top) * 0.6) / lineH(size));
  const cellLines = (b, cell, i, bold, size) => {
    const lines = wrapText(clean(cell == null ? '' : String(cell)), widthsOf(b)[i] - 2 * PAD_X, measure, size, bold);
    const max = maxLines(size);
    return lines.length > max ? [...lines.slice(0, max - 1), '… (pełny tekst w aplikacji)'] : lines;
  };
  const rowH = (b, row, bold = false) => Math.max(...row.map((c, i) => cellLines(b, c, i, bold, b.size || 8.5).length)) * lineH(b.size || 8.5) + 2 * PAD_Y;
  const tableHeadH = (b) => (b.noHead ? 0 : rowH(b, b.head, true));

  const drawRow = (b, row, bold) => {
    const size = b.size || 8.5;
    const ws = widthsOf(b);
    const h = rowH(b, row, bold);
    let x = PAGE.mx;
    row.forEach((cell, i) => {
      const lines = cellLines(b, cell, i, bold, size);
      const right = (b.align || [])[i] === 'r';
      lines.forEach((ln, k) => {
        const yy = y;
        y = yy + PAD_Y + k * lineH(size);
        text(ln, x + PAD_X, size, { bold, align: right ? 'right' : 'left', w: ws[i] - 2 * PAD_X });
        y = yy;
      });
      x += ws[i];
    });
    y += h;
    rule(y, bold ? GRAY.rule : GRAY.hair, bold ? 0.8 : 0.4);
  };

  const drawTable = (b) => {
    if (!b.rows.length) return;
    // krótka tabela (do ok. 1/4 strony) nie jest dzielona między strony
    const whole = tableHeadH(b) + b.rows.reduce((a, r) => a + rowH(b, r), 0);
    if (whole <= (limit - PAGE.top) / 4) need(whole);
    const head = () => { need(tableHeadH(b) + rowH(b, b.rows[0])); if (!b.noHead) drawRow(b, b.head, true); };
    head();
    for (const row of b.rows) {
      if (y + rowH(b, row) > limit) { newPage(); head(); }
      drawRow(b, row, false);
    }
    y += STYLES.p.after;
  };

  const drawLines = (lines, st, x = PAGE.mx, opts = {}) => {
    for (const ln of lines) {
      need(lineH(st.size));
      text(ln, x, st.size, { bold: st.bold, gray: st.muted ? GRAY.muted : GRAY.text, ...opts });
      y += lineH(st.size);
    }
  };

  blocks.forEach((b, i) => {
    const st = STYLES[b.type] || STYLES.p;
    if (b.type === 'table') { drawTable(b); return; }
    if (b.type === 'list') {
      for (const item of b.items) {
        const lines = wrapText(clean(item), CONTENT_W - 14, measure, st.size);
        need(lineH(st.size) * Math.min(lines.length, 2));
        lines.forEach((ln, k) => {
          need(lineH(st.size));
          if (k === 0) text('•', PAGE.mx + 3, st.size);
          text(ln, PAGE.mx + 14, st.size);
          y += lineH(st.size);
        });
      }
      y += st.after;
      return;
    }
    if (st.before) y += st.before;
    if (b.type === 'h3') need(lineH(st.size) + st.after + firstChunk(blocks[i + 1]));
    const lines = wrapText(clean(b.text), CONTENT_W, measure, b.size || st.size, Boolean(st.bold || b.bold));
    drawLines(lines, { ...st, size: b.size || st.size, muted: st.muted || b.muted, bold: st.bold || b.bold });
    y += st.after;
    if (b.type === 'title') { rule(y, GRAY.rule, 0.8); y += 6; }
  });
  return pages;
}
