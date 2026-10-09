'use client';
import SecHead from '../SecHead';
import { useState } from 'react';
import Frame from './Frame';
import HBars from './HBars';
import Empty from './Empty';
import { ddmm, num, plural } from './fmt';
import { SYMPTOMS } from '@/lib/symptoms';

// Porównanie okresów (POM-42): ostatnie 30 albo 90 dni (kolor danych) a tyle samo dni wcześniej (szary). Okna mają równą długość.
// Różnice to neutralny tekst („+0,4 g (+12%)”): bez strzałek, bez kolorów „lepiej/gorzej”, bez ocen. g i ml osobno.
// Nie ma tu nazw odmian, więc tryb dyskretny nic nie zmienia. Wartości są też w tabeli dla czytnika ekranu.
const PERIODS = [{ key: 'month', label: 'Miesiąc', days: 30 }, { key: 'quarter', label: 'Kwartał', days: 90 }];
const MINUS = '−';

// Różnica jako tekst; `pct` dopisuje procent tylko przy poprzedniej wartości > 0
function diffText(cur, prev, { unit = '', digits = 2, pct = true, days = false } = {}) {
  const d = Number((cur - prev).toFixed(digits));
  if (d === 0) return 'bez zmian';
  const sign = d > 0 ? '+' : MINUS;
  const abs = Math.abs(d);
  let t = `${sign}${num(abs, digits)}${days ? ` ${plural(abs, 'dzień', 'dni')}` : unit ? ` ${unit}` : ''}`;
  const p = prev > 0 ? Math.round((abs / prev) * 100) : 0;
  if (pct && p > 0) t += ` (${sign}${p}%)`;
  return t;
}

// Wiersze porównania dla jednego okresu: { key, name, note?, max, cur, prev, curText, prevText, diff, sym? }
function buildRows({ cur, prev }) {
  const mk = (key, name, c, p, o) => ({
    key, name, cur: c, prev: p, max: o.max ?? Math.max(c, p), curText: o.fmt(c), prevText: o.fmt(p), diff: diffText(c, p, o),
  });
  const g = { unit: 'g', fmt: (v) => `${num(v)} g` };
  const ml = { unit: 'ml', fmt: (v) => `${num(v)} ml` };
  const dni = { days: true, digits: 0, fmt: (v) => `${v} ${plural(v, 'dzień', 'dni')}` };
  const rows = [
    mk('use-g', 'Zużycie: susz', cur.grams, prev.grams, g),
    ...(cur.ml > 0 || prev.ml > 0 ? [mk('use-ml', 'Zużycie: olej i pen', cur.ml, prev.ml, ml)] : []),
    mk('days', 'Dni z użyciem', cur.activeDays, prev.activeDays, dni),
    mk('buy-g', 'Wykup: susz', cur.boughtGrams, prev.boughtGrams, g),
    ...(cur.boughtMl > 0 || prev.boughtMl > 0 ? [mk('buy-ml', 'Wykup: olej i pen', cur.boughtMl, prev.boughtMl, ml)] : []),
  ];
  const sym = SYMPTOMS.filter((s) => cur.symptoms[s.key].n > 0 || prev.symptoms[s.key].n > 0).map((s) => {
    const c = cur.symptoms[s.key], p = prev.symptoms[s.key];
    const both = c.avg != null && p.avg != null;
    const fmt = (v) => (v == null ? 'brak wpisów' : num(v, 1));
    return {
      key: `sym-${s.key}`, name: s.label, note: `0 = ${s.low}, 10 = ${s.high}`, max: 10, cur: c.avg, prev: p.avg,
      curText: fmt(c.avg), prevText: fmt(p.avg), nCur: c.n, nPrev: p.n,
      diff: both ? diffText(c.avg, p.avg, { digits: 1, pct: false }) : 'bez porównania',
    };
  });
  return { rows, sym };
}

export default function PeriodCompare({ compare }) {
  const [key, setKey] = useState('month');
  if (!compare) return null;
  const per = PERIODS.find((p) => p.key === key);
  const pair = compare[key];
  const { rows, sym } = buildRows(pair);
  const range = (w) => `${ddmm(w.from)}–${ddmm(w.to)}`;
  const curName = `Ostatnie ${per.days} dni`, prevName = `Poprzednie ${per.days} dni`;
  const empty = pair.cur.grams + pair.prev.grams + pair.cur.ml + pair.prev.ml + pair.cur.activeDays + pair.prev.activeDays
    + pair.cur.boughtGrams + pair.prev.boughtGrams + pair.cur.boughtMl + pair.prev.boughtMl + sym.length === 0;
  const all = [...rows, ...sym];

  const pairBars = (r) => (
    <HBars max={r.max} items={[
      { key: 'c', value: r.cur, text: r.curText, tone: 'data' },
      { key: 'p', value: r.prev, text: r.prevText, tone: 'ref' },
    ]} />
  );
  const rowView = (r) => (
    <div key={r.key} className="pc-row">
      <div className="pc-head"><span className="pc-name">{r.name}</span><span className="pc-diff">{r.diff}</span></div>
      {r.note && <p className="pc-note">{r.note}</p>}
      {pairBars(r)}
    </div>
  );

  return (
    <>
      <SecHead cat="stock" icon="trend">Porównanie okresów</SecHead>
      <Frame className="card pc"
        table={empty ? null : (
          <table>
            <caption>Porównanie: {curName.toLowerCase()} ({range(pair.cur)}) i {prevName.toLowerCase()} ({range(pair.prev)})</caption>
            <thead><tr><th scope="col">Pozycja</th><th scope="col">{curName}</th><th scope="col">{prevName}</th><th scope="col">Różnica</th></tr></thead>
            <tbody>
              {all.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.name}{r.note ? ` (${r.note})` : ''}</th>
                  <td>{r.curText}{r.nCur ? `, z ${r.nCur} ${plural(r.nCur, 'dnia', 'dni')}` : ''}</td>
                  <td>{r.prevText}{r.nPrev ? `, z ${r.nPrev} ${plural(r.nPrev, 'dnia', 'dni')}` : ''}</td>
                  <td>{r.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}>
        <div className="seg pc-seg" role="group" aria-label="Długość okresu">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={key === p.key} className={key === p.key ? 'on' : ''} onClick={() => setKey(p.key)}>{p.label}</button>
          ))}
        </div>
        <ul className="pc-legend">
          <li><i className="data" aria-hidden="true" /><span><b>{curName}</b> <span className="pc-range">{range(pair.cur)}</span></span></li>
          <li><i className="ref" aria-hidden="true" /><span><b>{prevName}</b> <span className="pc-range">{range(pair.prev)}</span></span></li>
        </ul>
        {empty ? (
          <Empty className="pc-empty">W tych okresach nie ma wpisów do porównania.</Empty>
        ) : (
          <div className="pc-rows" aria-hidden="true">
            {rows.map(rowView)}
            {sym.length > 0 && <h3 className="pc-sub">Objawy z dziennika</h3>}
            {sym.length > 0 && <p className="pc-note">Średnia z dni, w których zapisano dany objaw.</p>}
            {sym.map(rowView)}
          </div>
        )}
      </Frame>
    </>
  );
}
