// Eksport dziennika do CSV pod polski Excel: separator „;”, przecinek dziesiętny, UTF-8 z BOM, CRLF.
export const CSV_HEAD = ['Typ', 'Data', 'Godzina', 'Odmiana', 'Ilość', 'Jednostka', 'Koszt zł', 'Ból', 'Sen', 'Lęk', 'Nastrój', 'Notatka'];

// Ochrona przed wstrzyknięciem formuł (Excel/Calc): tekst zaczynający się od = + - @ (albo tabulatora/CR) dostaje apostrof z przodu.
export const csvText = (v) => {
  const s = v == null ? '' : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};
export const csvNum = (v) => (v == null || v === '' ? '' : String(Number(v)).replace('.', ','));

const csvCell = (s) => (/[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
export const csvLine = (cells) => cells.map((c) => csvCell(String(c ?? ''))).join(';');

export const buildDiaryCsv = (rows) => '\uFEFF' + [csvLine(CSV_HEAD), ...rows.map((r) => csvLine(Array.from({ length: CSV_HEAD.length }, (_, i) => r[i])))].join('\r\n') + '\r\n';
