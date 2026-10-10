// Generowanie PDF raportu dla lekarza w przeglądarce (POM-40). Ładowane dynamicznie po kliknięciu (import()), więc pdf-lib
// i fontkit nie trafiają do JS strony /raport. Dane zdrowotne nie opuszczają telefonu: font to plik z własnej domeny.
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PAGE, layoutReport } from './report-pdf-layout.js';
import { notesBlocks } from './report-pdf-model.js';

const FONTS = { regular: '/fonts/Figtree-Regular.ttf', bold: '/fonts/Figtree-Bold.ttf' };

async function loadFont(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Nie udało się pobrać czcionki raportu.');
  return new Uint8Array(await r.arrayBuffer());
}

// model: z buildReportModel; notes: aktualne punkty „Do omówienia” ([{ text }]); fontBytes: [regular, bold] (testy bez fetch)
export async function buildReportPdf(model, notes = [], fontBytes) {
  const [regBytes, boldBytes] = fontBytes || await Promise.all([loadFont(FONTS.regular), loadFont(FONTS.bold)]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(regBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  const chars = new Set(reg.getCharacterSet());
  // znak spoza fontu (emoji w notatce) pdf-lib odrzuciłby wyjątkiem: zastępujemy go znakiem zapytania
  const clean = (s) => Array.from(String(s).replace(/[  ]/g, ' ').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' '),
    (ch) => (ch === '\n' || chars.has(ch.codePointAt(0)) ? ch : '?')).join('');
  const measure = (t, size, isBold) => (isBold ? bold : reg).widthOfTextAtSize(t, size);

  const pages = layoutReport([...model.intro, ...notesBlocks(notes), ...model.blocks], { measure, clean });
  doc.setTitle(model.title || 'Raport');
  doc.setProducer('Zielnik');
  doc.setCreator('Zielnik');
  const total = pages.length;
  pages.forEach((ops, i) => {
    const page = doc.addPage([PAGE.w, PAGE.h]);
    const put = (t, x, y, size, isBold, gray = 0) => page.drawText(clean(t), { x, y: PAGE.h - y, size, font: isBold ? bold : reg, color: rgb(gray, gray, gray) });
    for (const o of ops) {
      if (o.t === 'text') put(o.text, o.x, o.y, o.size, o.bold, o.gray);
      else page.drawLine({ start: { x: o.x1, y: PAGE.h - o.y }, end: { x: o.x2, y: PAGE.h - o.y }, thickness: o.width, color: rgb(o.gray, o.gray, o.gray) });
    }
    // nagłówek (okres, data wygenerowania) i numeracja stron
    put(model.headerLeft, PAGE.mx, 36, 8.5, true);
    const hr = clean(model.headerRight);
    put(hr, PAGE.w - PAGE.mx - reg.widthOfTextAtSize(hr, 8.5), 36, 8.5, false, 0.35);
    page.drawLine({ start: { x: PAGE.mx, y: PAGE.h - 42 }, end: { x: PAGE.w - PAGE.mx, y: PAGE.h - 42 }, thickness: 0.5, color: rgb(0.55, 0.55, 0.55) });
    const foot = `Strona ${i + 1} z ${total}`;
    put(foot, (PAGE.w - reg.widthOfTextAtSize(foot, 8.5)) / 2, PAGE.h - 28, 8.5, false, 0.35);
  });
  return doc.save();
}
