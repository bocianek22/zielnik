// Raport skrócony po angielsku (POM-64), tylko PDF: te same dane i układ co wersja skrócona w lib/report-pdf-model.js,
// etykiety po angielsku, daty i liczby w formacie angielskim. Dane pacjenta (nazwy odmian, własnych objawów, pomiarów,
// czynników) bez tłumaczenia. Strona /raport zostaje po polsku. Zmieniasz zdania wersji skróconej: zmień je też tutaj
// (tests/report-pdf.test.js porównuje oba modele i pilnuje jednej strony).
import { SYMPTOMS } from './symptoms.js';
import { printDay, printNum } from './print-format.js';
import { shortUsage, SHORT_ADVERSE } from './report-pdf-model.js';

const L = 'en';
const nf = (n, max = 1) => printNum(n, L, max);
const day = (iso) => printDay(iso, L);
const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
const av = (v) => (v == null ? '–' : nf(v));
const SYM_EN = { pain: 'pain', sleep: 'sleep', anxiety: 'anxiety', mood: 'mood' };
const SEV_EN = { lagodne: 'mild', umiarkowane: 'moderate', silne: 'severe' };
const U_EN = { g: 'dried flower', ml: 'oil and vape pen' };

export const pdfFileNameEn = (today) => `report-${today}.pdf`;
export const NOTES_HEAD_EN = 'To discuss with the doctor';

export function buildBriefModelEn({ patient, from, to, today, report }) {
  const { usage, sym, customSym, totals, rx, rxSum, factors = [], adverse = [], measures = [] } = report;
  const daysSpan = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const { used, bought, cost } = totals;
  const hasMl = used.ml > 0 || bought.ml > 0 || rxSum.prescribed.ml > 0;
  const units = [(!hasMl || used.g > 0 || bought.g > 0 || rxSum.prescribed.g > 0) && 'g', hasMl && 'ml'].filter(Boolean);
  const rxUnits = units.filter((u) => rxSum.prescribed[u] > 0);
  const rxQty = (o) => rxUnits.filter((u) => o[u] > 0).map((u) => `${nf(o[u], 2)} ${u}`).join(' and ') || '0';

  const intro = [
    { type: 'title', text: 'Summary of medical cannabis use' },
    { type: 'p', text: `Patient: ${patient}\nPeriod: ${day(from)} to ${day(to)} (${days(daysSpan)})` },
    { type: 'small', text: `Made on ${day(today)} from records kept by the patient in the Zielnik app. Not a medical record and not an assessment of treatment effectiveness.` },
  ];

  const b = [];
  b.push({ type: 'h3', text: 'Summary' });
  b.push({
    type: 'table', widths: [3, ...units.map(() => 2)], align: ['l', ...units.map(() => 'r')], size: 9.5,
    head: ['', ...units.map((u) => (units.length > 1 ? `${u} (${U_EN[u]})` : u))],
    rows: [
      ['Used', ...units.map((u) => `${nf(used[u], 2)} ${u}`)],
      ['Average per day', ...units.map((u) => `${nf(used[u] / daysSpan, 2)} ${u}`)],
      ['Dispensed', ...units.map((u) => `${nf(bought[u], 2)} ${u}`)],
    ],
  });
  b.push({ type: 'small', text: `Strains used: ${usage.length}. Days with a symptom entry: ${sym.days} of ${daysSpan}.${cost > 0 ? ` Cost of purchases: approx. ${nf(cost, 2)} PLN.` : ''}` });

  b.push({ type: 'h3', text: 'Symptoms' });
  b.push({ type: 'small', text: sym.days > 0
    ? `Whole period (${days(sym.days)} with an entry), averages on a 0–10 scale: ${SYMPTOMS.map((s) => `${SYM_EN[s.key] ?? s.short} ${av(sym[s.key])}`).join(', ')}. Pain and anxiety: higher means worse. Sleep and mood: higher means better.`
    : 'No symptom entries in this period.' });
  if (factors.length) b.push({ type: 'small', text: `Daily factors marked by the patient (number of days in the period, no ratings): ${factors.map((f) => `${f.name} (${days(f.days)})`).join(', ')}.` });
  if (customSym.some((c) => c.days > 0)) {
    b.push({ type: 'small', text: `Patient’s own symptoms (0–10 scale, direction set by the patient): ${customSym.filter((c) => c.days > 0).map((c) => `${c.name} (higher = ${c.higher_better ? 'better' : 'worse'}): average ${av(c.avg)} over ${days(c.days)}`).join('; ')}.` });
  }
  if (measures.length > 0) {
    b.push({ type: 'small', text: `Patient’s measurements, averages for the period: ${measures.map((m) => `${m.name} ${nf(Math.round(m.avg * 100) / 100, 2)}${m.unit ? ` ${m.unit}` : ''}`).join('; ')}.` });
  }
  if (adverse.length > 0) {
    const n = adverse.length, rest = n - SHORT_ADVERSE;
    const shown = adverse.slice(0, SHORT_ADVERSE).map((a) => `${day(a.day)} (${SEV_EN[a.severity] ?? a.severity})`).join('; ');
    b.push({ type: 'small', text: `Adverse events recorded by the patient (date and severity as judged by the patient, not an assessment of a link to treatment): ${n} ${n === 1 ? 'event' : 'events'}, ${shown}${rest > 0 ? ` and ${rest} earlier` : ''}.` });
  }

  b.push({ type: 'h3', text: 'Prescriptions in the period' });
  if (rx.length === 0) b.push({ type: 'p', text: 'No recorded prescriptions valid in this period.' });
  else {
    b.push({
      type: 'table', widths: [3, 2], align: ['l', 'l'], size: 9, head: ['', ''],
      rows: [
        ['Issued in the period', String(rxSum.issued)], [`Valid on ${day(to)}`, String(rxSum.valid)],
        ['Prescribed', rxQty(rxSum.prescribed)], ['Dispensed under prescriptions', rxQty(rxSum.bought)],
        ['Unused (expired)', rxQty(rxSum.unused)], ['Still to dispense (valid)', rxQty(rxSum.left)],
      ],
      noHead: true,
    });
  }
  b.push({ type: 'small', text: `Dispensing counted from purchases recorded by the patient within the prescription’s validity, up to ${day(to)}; dried flower in grams, oil and vape pen in ml, separately.` });

  b.push({ type: 'h3', text: 'Use by strain' });
  if (usage.length === 0) b.push({ type: 'p', text: 'No use recorded in this period.' });
  else {
    const { shown, rest } = shortUsage(usage);
    b.push({
      type: 'table', widths: [4, 1.3, 1.6], align: ['l', 'r', 'r'], size: 8.5, head: ['Strain', 'Days used', 'Total'],
      rows: shown.map((u) => [u.name, String(u.days), `${nf(u.grams, 2)} ${u.unit}`]),
    });
    if (rest.length) {
      const by = {};
      for (const u of rest) by[u.unit] = (by[u.unit] || 0) + Number(u.grams);
      b.push({ type: 'small', text: `Other strains (${rest.length}): total ${Object.entries(by).map(([u, g]) => `${nf(g, 2)} ${u}`).join(' and ')}.` });
    }
  }
  b.push({ type: 'small', text: 'Short version. The full report (week by week, purchases, symptoms by strain, patient-reported effects) is available in the app.' });

  return {
    from, to, today, lang: L, fileName: pdfFileNameEn(today), notesHead: NOTES_HEAD_EN,
    headerLeft: `Short report: ${day(from)} – ${day(to)}`,
    headerRight: `Generated ${day(today)}`,
    intro, blocks: b,
  };
}
