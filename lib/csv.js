// Prosty parser CSV (separator ; lub ,, cudzysłowy, BOM). Zwraca tablicę wierszy (tablic).
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split('\n')[0];
  const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  const endRow = () => { row.push(cur); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else cur += c;
  }
  if (cur !== '' || row.length) endRow();
  return rows;
}

// Tabela CSV -> tablica obiektów (klucze z nagłówka)
export function csvToObjects(text) {
  const t = parseCsv(text);
  if (t.length < 2) return [];
  return t.slice(1).map((r) => Object.fromEntries(t[0].map((h, i) => [h.trim(), r[i]])));
}
