// PDF raportu dla lekarza (POM-40): zawijanie, łamanie tabel na strony, model treści i sam plik (bez przeglądarki).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAGE, CONTENT_W, wrapText, columnWidths, layoutReport } from '../lib/report-pdf-layout.js';
import { buildReportModel, pdfFileName, notesBlocks } from '../lib/report-pdf-model.js';
import { buildReportPdf } from '../lib/report-pdf.js';

const measure = (t, size) => t.length * size * 0.5; // makieta: stała szerokość znaku
const fonts = () => ['Regular', 'Bold'].map((w) => new Uint8Array(fs.readFileSync(new URL(`../public/fonts/Figtree-${w}.ttf`, import.meta.url))));

test('wrapText: zawija po spacjach, łamie za długie słowa, szanuje \\n', () => {
  assert.deepEqual(wrapText('ala ma kota', 1000, measure, 10), ['ala ma kota']);
  assert.deepEqual(wrapText('ala ma kota', 25, measure, 10), ['ala', 'ma', 'kota']);
  assert.deepEqual(wrapText('abcdefghij', 20, measure, 10), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(wrapText('a\nb', 1000, measure, 10), ['a', 'b']);
  assert.deepEqual(wrapText('', 100, measure, 10), ['']);
});

test('columnWidths: suma równa szerokości treści', () => {
  const w = columnWidths([1, 2, 1]);
  assert.equal(w.length, 3);
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - CONTENT_W) < 1e-9);
  assert.equal(w[1], w[0] * 2);
});

const table = (n) => ({ type: 'table', head: ['Data', 'Odmiana', 'Ilość'], widths: [1, 3, 1], align: ['l', 'l', 'r'],
  rows: Array.from({ length: n }, (_, i) => [`${i}.10`, `Odmiana ${i}`, `${i} g`]) });

test('layoutReport: długa tabela łamie się na strony, nagłówek tabeli powtarza się, nic nie wychodzi poza margines', () => {
  const pages = layoutReport([{ type: 'title', text: 'Tytuł' }, { type: 'h3', text: 'Zakupy' }, table(120)], { measure });
  assert.ok(pages.length > 2, `stron: ${pages.length}`);
  for (const p of pages) {
    assert.ok(p.some((o) => o.t === 'text' && o.text === 'Data' && o.bold), 'nagłówek tabeli na każdej stronie');
    for (const o of p) {
      const y = o.y;
      assert.ok(y >= PAGE.top - 1 && y <= PAGE.h - PAGE.bottom + 12, `y=${y} poza obszarem treści`);
      if (o.t === 'text') assert.ok(o.x >= PAGE.mx - 0.01 && o.x + measure(o.text, o.size) <= PAGE.w - PAGE.mx + 0.01, `"${o.text}" poza marginesem`);
    }
  }
  const rows = pages.flat().filter((o) => o.t === 'text' && /^Odmiana \d+$/.test(o.text)).length;
  assert.equal(rows, 120, 'żaden wiersz nie ginie ani się nie dubluje');
});

test('layoutReport: nagłówek sekcji nie zostaje sam na dole strony', () => {
  const filler = { type: 'p', text: Array(58).fill('wiersz').join('\n') }; // prawie pełna strona
  const pages = layoutReport([filler, { type: 'h3', text: 'Sekcja' }, table(3)], { measure });
  const withH = pages.findIndex((p) => p.some((o) => o.text === 'Sekcja'));
  assert.ok(pages[withH].some((o) => o.text === 'Data'), 'nagłówek sekcji na tej samej stronie co początek tabeli');
});

test('layoutReport: lista punktów z kropką, długi punkt zawija się', () => {
  const pages = layoutReport([{ type: 'list', items: ['Zapytać o przedłużenie recepty', 'x '.repeat(200)] }], { measure });
  const ops = pages.flat();
  assert.equal(ops.filter((o) => o.text === '•').length, 2);
});

const report = {
  usage: [{ name: 'Żółć Gęślą Jaźń', producer: 'Łąka', thc: 22, cbd: 0.5, days: 3, grams: 4.5, unit: 'g' }],
  weekly: [{ start: '2026-09-28', end: '2026-10-04', used_g: 2.5, used_ml: 0, use_days: 3, bought_g: 5, bought_ml: 0, sym_days: 2, pain: 4, sleep: 6, anxiety: 3, mood: 7 }],
  purchases: [{ name: 'Żółć Gęślą Jaźń', at: '2026-09-30', grams: 5, unit: 'g', cost: 120 }],
  feel: [{ name: 'Żółć Gęślą Jaźń', rating: 8, effects: { relax: 7 }, notes: 'Dobrze „działa”' }],
  sym: { days: 2, pain: 4, sleep: 6, anxiety: 3, mood: 7 }, customSym: [],
  totals: { used: { g: 4.5, ml: 0 }, bought: { g: 5, ml: 0 }, cost: 120 },
  rx: [{ id: 1, issued_on: '2026-09-01', valid_until: '2026-12-01', grams: 10, bought: 5, unit: 'g', remaining: 5, status: 'valid' }],
  rxSum: { issued: 1, valid: 1, prescribed: { g: 10, ml: 0 }, bought: { g: 5, ml: 0 }, unused: { g: 0, ml: 0 }, left: { g: 5, ml: 0 } },
  strainSym: [], whenUsed: { period: [{ key: 'evening', n: 2 }], method: [{ key: 'vaporizer', n: 2 }] },
};
const model = () => buildReportModel({ patient: 'Zażółć', from: '2026-09-11', to: '2026-10-10', today: '2026-10-10', withNotes: true, report, minSymptomDays: 5 });

test('model: neutralna nazwa pliku i treść z raportu (g i ml osobno, recepty, odczucia)', () => {
  assert.equal(pdfFileName('2026-10-10'), 'raport-2026-10-10.pdf');
  const m = model();
  assert.doesNotMatch(m.fileName, /konop|cannab|zielnik/i);
  const all = JSON.stringify(m);
  for (const frag of ['Recepty w okresie', 'Zużycie według odmian', 'Zakupy', 'Odczucia pacjenta', 'Spostrzeżenia', 'Dobrze „działa”', 'Pacjent: Zażółć']) assert.ok(all.includes(frag), frag);
  const ml = buildReportModel({ patient: 'A', from: '2026-09-11', to: '2026-10-10', today: '2026-10-10', withNotes: false, minSymptomDays: 5,
    report: { ...report, totals: { used: { g: 1, ml: 5 }, bought: { g: 0, ml: 0 }, cost: 0 } } });
  assert.ok(JSON.stringify(ml).includes('ml (olej i pen)'));
});

test('notesBlocks: bez punktów nic, z punktami nagłówek i lista', () => {
  assert.deepEqual(notesBlocks([]), []);
  assert.equal(notesBlocks([{ text: 'a' }])[1].items[0], 'a');
});

test('buildReportPdf: poprawny PDF z polskimi znakami, emoji nie wywraca generatora, numeracja stron', async () => {
  const m = { ...model(), title: 'Raport' };
  const many = { ...m, blocks: [...m.blocks, { type: 'h3', text: 'Długa lista' }, table(150)] };
  const bytes = await buildReportPdf(many, [{ text: 'Zapytać o dawkowanie 😀 i „cudzysłów” – ąćęłńóśźż' }], fonts());
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
  assert.ok(bytes.length > 5000);
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3);
  const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
  assert.ok(Math.abs(w - 595.28) < 0.01 && Math.abs(h - 841.89) < 0.01, 'A4');
});

test('layoutReport: komórka wyższa niż strona jest przycięta ze znacznikiem, nic nie leży pod dolnym marginesem', () => {
  const long = Array.from({ length: 150 }, (_, i) => `linia ${i}`).join('\n');
  const pages = layoutReport([{ type: 'table', head: ['Odmiana', 'Spostrzeżenia'], widths: [1, 2], rows: [['A', long], ['B', 'krótko']] }], { measure });
  const texts = pages.flat().filter((o) => o.t === 'text');
  for (const o of texts) assert.ok(o.y <= PAGE.h - PAGE.bottom + 0.01, `"${o.text}" pod marginesem (${o.y})`);
  assert.ok(texts.some((o) => o.text === '… (pełny tekst w aplikacji)'));
  assert.ok(texts.some((o) => o.text === 'krótko'), 'następny wiersz nie ginie');
});

test('wersja skrócona (POM-56): bez list o nieograniczonej długości, najwyżej 5 odmian; bez punktów 1 strona, najgorszy przypadek 2', async () => {
  const strains = Array.from({ length: 14 }, (_, i) => ({ name: `Bardzo długa nazwa odmiany numer ${i + 1} z dopiskiem`, producer: 'Producent', thc: 20, cbd: 1, days: 30 - i, grams: 10 + i, unit: i % 3 ? 'g' : 'ml' }));
  const big = {
    ...report, usage: strains,
    weekly: Array.from({ length: 13 }, () => report.weekly[0]), purchases: Array.from({ length: 30 }, () => report.purchases[0]),
    rx: Array.from({ length: 12 }, (_, i) => ({ ...report.rx[0], id: i })),
    customSym: [1, 2, 3].map((i) => ({ name: `Własny objaw ${i} o dłuższej nazwie`, higher_better: i === 1, days: 20, avg: 5.5 })),
    factors: Array.from({ length: 8 }, (_, i) => ({ name: `czynnik dnia ${i + 1}`, days: 12 })),
    adverse: Array.from({ length: 12 }, (_, i) => ({ day: `2026-10-${String(10 - (i % 9)).padStart(2, '0')}`, severity: 'silne', note: `opis zdarzenia ${i} `.repeat(60) })),
    totals: { used: { g: 300, ml: 40 }, bought: { g: 350, ml: 50 }, cost: 4000 },
    rxSum: { ...report.rxSum, prescribed: { g: 400, ml: 60 } },
  };
  const m = buildReportModel({ patient: 'Zażółć Gęślą', from: '2026-07-13', to: '2026-10-10', today: '2026-10-10', withNotes: true, report: big, minSymptomDays: 5, short: true });
  const all = JSON.stringify(m);
  // najczęstsze po dniach użycia, bez względu na jednostkę (olej nie spada za susz)
  const mix = buildReportModel({ patient: 'A', from: '2026-09-11', to: '2026-10-10', today: '2026-10-10', withNotes: false, minSymptomDays: 5, short: true,
    report: { ...big, usage: [...Array.from({ length: 6 }, (_, i) => ({ name: `Susz ${i}`, days: 5, grams: 20, unit: 'g' })), { name: 'Olej główny', days: 25, grams: 10, unit: 'ml' }] } });
  assert.ok(JSON.stringify(mix).includes('Olej główny'));
  for (const gone of ['opis zdarzenia', 'Tydzień po tygodniu', 'Zakupy', 'Odczucia pacjenta', 'Pory dnia', 'Objawy w dniach z odmianą', 'Wystawiona']) assert.ok(!all.includes(gone), gone);
  for (const kept of ['Podsumowanie', 'Recepty w okresie', 'Zużycie według odmian', 'Pozostałe odmiany (9)', 'Cały okres', 'czynnik dnia 8', 'Wersja skrócona', '12 zdarzeń, 10 października 2026 (silne)', 'i 7 wcześniejszych']) assert.ok(all.includes(kept), kept);
  const notes = (n) => Array.from({ length: n }, (_, i) => ({ text: `Punkt ${i + 1}: ${'zapytać o szczegóły leczenia i dalszy plan '.repeat(5).slice(0, 190)}` }));
  const { PDFDocument } = await import('pdf-lib');
  const pages = async (n) => (await PDFDocument.load(await buildReportPdf({ ...m, title: 'Raport' }, notes(n), fonts()))).getPageCount();
  assert.equal(await pages(0), 1, 'dużo danych bez punktów „Do omówienia”: jedna strona');
  assert.ok(await pages(10) <= 2, 'najgorszy przypadek (10 punktów po 200 znaków) najwyżej 2 strony');
});

test('zdarzenia niepożądane (POM-62): pełny raport z opisem tylko gdy jest w danych, bez zdarzeń bez sekcji', () => {
  const adverse = [{ day: '2026-10-08', severity: 'silne', note: 'Zawroty\ngłowy' }, { day: '2026-10-01', severity: 'lagodne', note: '' }];
  const all = JSON.stringify(buildReportModel({ patient: 'A', from: '2026-09-11', to: '2026-10-10', today: '2026-10-10', withNotes: true, report: { ...report, adverse }, minSymptomDays: 5 }));
  for (const t of ['Zdarzenia niepożądane', '8 października 2026, nasilenie: silne: Zawroty głowy', '1 października 2026, nasilenie: łagodne', 'nie jest oceną związku z leczeniem']) assert.ok(all.includes(t), t);
  assert.ok(!JSON.stringify(model()).includes('Zdarzenia niepożądane'));
});
