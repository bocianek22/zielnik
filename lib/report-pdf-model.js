// Treść PDF raportu dla lekarza (POM-40): te same dane i te same zdania co arkusz na stronie /raport (app/raport/page.js),
// ale jako płaska lista bloków dla lib/report-pdf-layout.js. Czysta funkcja, liczona na serwerze razem ze stroną
// (zero dodatkowych zapytań); do przeglądarki trafia gotowy model, a PDF powstaje lokalnie (lib/report-pdf.js).
// Zmieniasz treść arkusza w page.js: zmień ją też tutaj (tests/report-pdf.test.js pilnuje podstaw).
import { EFFECTS } from './effects.js';
import { SYMPTOMS } from './symptoms.js';
import { METHODS, PERIODS, periodLabel } from './usage-meta.js';
import { formatDay } from './date.js';

const nf = (n, max = 1) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: max });
const dni = (n) => `${n} ${n === 1 ? 'dzień' : 'dni'}`;
const dniGen = (n) => `${n} ${n === 1 ? 'dnia' : 'dni'}`;
const av = (v) => (v == null ? '–' : nf(v));
const short = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const PERIOD_KEYS = Object.keys(PERIODS);

// Nazwa pliku: bez słowa o konopi i bez nazwisk, w trybie dyskretnym taka sama (data wygenerowania)
export const pdfFileName = (today) => `raport-${today}.pdf`;

// Punkty „Do omówienia”: dołączane w chwili klikania, bo użytkownik może je zmienić na stronie bez przeładowania
export const notesBlocks = (notes) => (notes.length
  ? [{ type: 'h3', text: 'Do omówienia z lekarzem' }, { type: 'list', items: notes.map((n) => n.text) }]
  : []);

export function buildReportModel({ patient, from, to, today, withNotes, report, minSymptomDays: MIN_SYMPTOM_DAYS }) {
  const { usage, weekly, purchases, feel: feelAll, sym, customSym, totals, rx, rxSum, strainSym, whenUsed } = report;
  const day = formatDay;
  const daysSpan = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const { used, bought, cost } = totals;
  const hasMl = used.ml > 0 || bought.ml > 0 || rxSum.prescribed.ml > 0;
  const units = [(!hasMl || used.g > 0 || bought.g > 0 || rxSum.prescribed.g > 0) && 'g', hasMl && 'ml'].filter(Boolean);
  const uLabel = { g: 'susz', ml: 'olej i pen' };
  const both = (o) => units.map((u) => `${nf(o[u], 2)} ${u}`).join(' i ');
  const fx = (o, k) => (o && o[k] != null ? o[k] : null);
  const feel = feelAll.filter((f) => f.rating != null || EFFECTS.some(([k]) => f.effects?.[k] != null) || (withNotes && f.notes));
  const weekRange = (w) => (w.start === w.end ? short(w.start) : `${short(w.start)}–${short(w.end)}`);
  const anyWeekData = weekly.some((w) => w.use_days || w.sym_days || w.bought_g || w.bought_ml);
  const rxState = (r) => (r.status === 'used' ? 'wykupiona w całości'
    : r.status === 'expired' ? `wygasła, niewykorzystane ${nf(r.remaining, 2)} ${r.unit}`
      : `${r.valid_until ? 'ważna' : 'bez terminu'}, do wykupienia ${nf(r.remaining, 2)} ${r.unit}`);
  const rxUnits = units.filter((u) => rxSum.prescribed[u] > 0);
  const rxQty = (o) => rxUnits.filter((u) => o[u] > 0).map((u) => `${nf(o[u], 2)} ${u}`).join(' i ') || '0';
  const symCell = (s, k) => (s[`n_${k}`] >= MIN_SYMPTOM_DAYS ? `${nf(s[k])} (${dniGen(s[`n_${k}`])})` : s[`n_${k}`] ? `za mało dni (${s[`n_${k}`]})` : '–');

  const intro = [
    { type: 'title', text: 'Zestawienie stosowania medycznej konopi' },
    { type: 'p', text: `Pacjent: ${patient}\nOkres: ${day(from)} do ${day(to)} (${dni(daysSpan)})` },
    { type: 'small', text: `Zestawienie powstało ${day(today)} z zapisów prowadzonych przez pacjenta w aplikacji Zielnik. Nie jest dokumentacją medyczną ani oceną skuteczności leczenia.` },
  ];

  const b = [];
  b.push({ type: 'h3', text: 'Podsumowanie' });
  b.push({
    type: 'table', widths: [3, ...units.map(() => 2)], align: ['l', ...units.map(() => 'r')], size: 9.5,
    head: ['', ...units.map((u) => (units.length > 1 ? `${u} (${uLabel[u]})` : u))],
    rows: [
      ['Zużycie', ...units.map((u) => `${nf(used[u], 2)} ${u}`)],
      ['Średnio na dzień', ...units.map((u) => `${nf(used[u] / daysSpan, 2)} ${u}`)],
      ['Wykupiono', ...units.map((u) => `${nf(bought[u], 2)} ${u}`)],
    ],
  });
  b.push({ type: 'small', text: `Liczba użytych odmian: ${usage.length}. Dni z wpisem objawów: ${sym.days} z ${daysSpan}.${cost > 0 ? ` Koszt zakupów: ok. ${nf(cost, 2)} zł.` : ''}` });

  b.push({ type: 'h3', text: 'Tydzień po tygodniu' });
  if (!anyWeekData) b.push({ type: 'p', text: 'Brak zapisów w tym okresie.' });
  else {
    b.push({
      type: 'table', size: 8,
      widths: [2.3, ...units.map(() => 1.5), 1.1, ...units.map(() => 1.5), 1.4, ...SYMPTOMS.map(() => 1.3)],
      align: ['l', ...units.map(() => 'r'), 'r', ...units.map(() => 'r'), 'r', ...SYMPTOMS.map(() => 'r')],
      head: ['Tydzień', ...units.map((u) => `Zużycie ${u}`), 'Dni użycia', ...units.map((u) => `Wykup ${u}`), 'Dni z objawami', ...SYMPTOMS.map((s) => s.short)],
      rows: weekly.map((w) => [weekRange(w), ...units.map((u) => nf(u === 'g' ? w.used_g : w.used_ml, 2)), String(w.use_days),
        ...units.map((u) => nf(u === 'g' ? w.bought_g : w.bought_ml, 2)), String(w.sym_days), ...SYMPTOMS.map((s) => av(w[s.key]))]),
    });
  }
  b.push({ type: 'small', text: `Objawy w tabeli: średnie 0–10. Tygodnie od poniedziałku, pierwszy i ostatni mogą być niepełne. Ból i lęk: wyższa wartość oznacza gorzej. Sen i nastrój: wyższa wartość oznacza lepiej.${sym.days > 0 ? ` Cały okres (${dniGen(sym.days)} z wpisem): ${SYMPTOMS.map((s) => `${s.short} ${av(sym[s.key])}`).join(', ')}.` : ''}` });
  if (customSym.some((c) => c.days > 0)) {
    b.push({ type: 'small', text: `Własne objawy pacjenta (skala 0–10, kierunek ustawiony przez pacjenta): ${customSym.filter((c) => c.days > 0).map((c) => `${c.name} (wyżej = ${c.higher_better ? 'lepiej' : 'gorzej'}): średnio ${av(c.avg)} z ${dniGen(c.days)}`).join('; ')}.` });
  }

  b.push({ type: 'h3', text: 'Recepty w okresie' });
  if (rx.length === 0) b.push({ type: 'p', text: 'Brak zapisanych recept ważnych w tym okresie.' });
  else {
    b.push({
      type: 'table', widths: [3, 2], align: ['l', 'l'], size: 9, head: ['', ''],
      rows: [
        ['Wystawione w okresie', String(rxSum.issued)], [`Ważne na ${day(to)}`, String(rxSum.valid)],
        ['Przepisano', rxQty(rxSum.prescribed)], ['Wykupiono w ramach recept', rxQty(rxSum.bought)],
        ['Niewykorzystane (wygasłe)', rxQty(rxSum.unused)], ['Do wykupienia (ważne)', rxQty(rxSum.left)],
      ],
      noHead: true,
    });
    b.push({
      type: 'table', widths: [2, 2, 1.6, 1.6, 3.2], align: ['l', 'l', 'r', 'r', 'l'], size: 8.5,
      head: ['Wystawiona', 'Ważna do', 'Przepisano', 'Wykupiono', `Stan na ${short(to)}`],
      rows: rx.map((r) => [day(r.issued_on), r.valid_until ? day(r.valid_until) : 'bez terminu', `${nf(r.grams, 2)} ${r.unit}`, `${nf(r.bought, 2)} ${r.unit}`, rxState(r)]),
    });
  }
  b.push({ type: 'small', text: `Wykup liczony z zakupów zapisanych przez pacjenta w okresie ważności recepty, do ${day(to)}; susz w gramach, olej i pen w ml osobno.` });

  b.push({ type: 'h3', text: 'Zużycie według odmian' });
  if (usage.length === 0) b.push({ type: 'p', text: 'Brak zapisanego zużycia w tym okresie.' });
  else {
    b.push({
      type: 'table', widths: [3, 2.4, 1, 1, 1.3, 1.6], align: ['l', 'l', 'l', 'l', 'r', 'r'], size: 8.5,
      head: ['Odmiana', 'Producent', 'THC', 'CBD', 'Dni użycia', 'Razem'],
      rows: usage.map((u) => [u.name, u.producer || '', u.thc != null ? `${nf(u.thc)}%` : '–', u.cbd != null ? `${nf(u.cbd)}%` : '–', String(u.days), `${nf(u.grams, 2)} ${u.unit}`]),
    });
  }

  if (whenUsed.period.length > 0) {
    b.push({ type: 'h3', text: 'Pory dnia i sposób przyjęcia' });
    const per = PERIOD_KEYS.filter((k) => whenUsed.period.some((r) => r.key === k)).map((k) => `${periodLabel(k)} ${whenUsed.period.find((r) => r.key === k).n}`).join(', ');
    const met = whenUsed.method.length > 0
      ? ` Sposób (tam, gdzie podano): ${Object.keys(METHODS).filter((k) => whenUsed.method.some((r) => r.key === k)).map((k) => `${METHODS[k]} ${whenUsed.method.find((r) => r.key === k).n}`).join(', ')}.` : '';
    b.push({ type: 'p', text: `Wpisy zużycia według pory: ${per}.${met}` });
    b.push({ type: 'small', text: 'Liczba wpisów zużycia, nie ilość. Pora pochodzi z wyboru pacjenta albo z godziny zapisu.' });
  }

  if (strainSym.length > 0 && sym.days > 0) {
    b.push({ type: 'h3', text: 'Objawy w dniach z odmianą' });
    b.push({
      type: 'table', size: 8, widths: [2.6, 1.4, ...SYMPTOMS.map(() => 2)], align: ['l', 'r', ...SYMPTOMS.map(() => 'l')],
      head: ['Odmiana', 'Dni użycia', ...SYMPTOMS.map((x) => x.label)],
      rows: strainSym.map((s) => [s.name, `${s.days}${s.mixed > 0 ? ` (${s.mixed} miesz.)` : ''}`, ...SYMPTOMS.map((x) => symCell(s, x.key))]),
    });
    b.push({ type: 'small', text: `Średnie objawów z dni, w których zapisano użycie odmiany; w nawiasie liczba dni z wpisem. Ból, lęk i nastrój z tego samego dnia, jakość snu z dnia następnego (wpis dotyczy minionej nocy). Dzień z kilkoma odmianami liczy się przy każdej z nich (dni mieszane, w tabeli „miesz.”). Średnią podajemy przy co najmniej ${MIN_SYMPTOM_DAYS} dniach z wpisem. To zestawienie zapisów pacjenta, nie porównanie skuteczności odmian.` });
  }

  if (purchases.length > 0) {
    b.push({ type: 'h3', text: 'Zakupy' });
    b.push({
      type: 'table', widths: [2, 4, 1.8, 1.6], align: ['l', 'l', 'r', 'r'], size: 8.5, head: ['Data', 'Odmiana', 'Ilość', 'Koszt'],
      rows: purchases.map((p) => [day(p.at), p.name, `${nf(p.grams, 2)} ${p.unit}`, p.cost != null ? `${nf(p.cost, 2)} zł` : '–']),
    });
    b.push({ type: 'small', text: `Razem: ${both(bought)}.` });
  }

  if (feel.length > 0) {
    b.push({ type: 'h3', text: 'Odczucia pacjenta (skala 0–10)' });
    b.push({
      type: 'table', size: 8, widths: [3, 1.2, ...EFFECTS.map(() => 1.5), ...(withNotes ? [4] : [])],
      align: ['l', 'r', ...EFFECTS.map(() => 'r'), ...(withNotes ? ['l'] : [])],
      head: ['Odmiana', 'Ocena', ...EFFECTS.map(([, l]) => l), ...(withNotes ? ['Spostrzeżenia'] : [])],
      rows: feel.map((f) => [f.name, f.rating != null ? nf(f.rating) : '–', ...EFFECTS.map(([k]) => (fx(f.effects, k) != null ? nf(fx(f.effects, k)) : '–')), ...(withNotes ? [f.notes || '–'] : [])]),
    });
    b.push({ type: 'small', text: 'Ogólne oceny odmian wpisane przez pacjenta, niezwiązane z okresem raportu.' });
  }

  return {
    from, to, today, fileName: pdfFileName(today),
    headerLeft: `Raport: ${day(from)} – ${day(to)}`,
    headerRight: `Wygenerowano ${day(today)}`,
    intro, blocks: b,
  };
}
