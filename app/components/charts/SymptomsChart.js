'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Frame from './Frame';
import Bars from './Bars';
import Scrub from './Scrub';
import Empty from './Empty';
import { layoutLabels } from './labels';
import { niceTicks } from './scale';
import { rolling, segments } from './trend';
import { addDays, ddmm, longDay, num, plural, weekday } from './fmt';

// Dziennik: objawy z 30 dni jako małe wykresy, po jednym na objaw (każdy z własnym `svg.sym-chart`; E2E szuka tej klasy i w stanie
// pustym jej nie ma), oraz osobny panel zużycia na własnej skali. Nie ma wspólnej osi Y ani nakładki zużycia na objawy.
// Linia to średnia z 7 dni, ale tylko tam, gdzie w tych 7 dniach jest co najmniej 4 wpisy; pasmo to zakres (min–max) z tych 7 dni.
// Kropki to surowe wpisy. Jeden Scrub (dotyk, strzałki) wybiera dzień we wszystkich panelach. Na komputerze przełącznik „Razem”:
// jeden wykres, w którym wyróżniony objaw jest w --chart-data, a reszta w --chart-ref, z podpisami na końcach linii.
const N = 30, W = 326, WIN = 7, MIN = 4;
const px = (i) => ((i + 0.5) * W) / N;
const pct = (i) => `${((i + 0.5) / N) * 100}%`;
const dn = (s) => (s.custom ? 'dn' : undefined); // własne nazwy objawów w trybie dyskretnym
// trend opisowo: różnica średnich z 7 dni, pierwszej i ostatniej dostępnej w 30 dniach (bez oceny, czy to lepiej, czy gorzej)
function trendOf(tr) {
  const m = tr.filter(Boolean);
  if (m.length < 2) return null;
  const diff = Math.round((m.at(-1).mean - m[0].mean) * 10) / 10;
  return diff === 0 ? { text: 'bez zmian', title: 'Średnia z 7 dni nie zmieniła się w ostatnich 30 dniach' }
    : { text: `${diff > 0 ? '+' : '−'}${num(Math.abs(diff), 1)} w 30 dni`, title: `Średnia z 7 dni zmieniła się o ${diff > 0 ? '+' : '−'}${num(Math.abs(diff), 1)} w ostatnich 30 dniach` };
}
const wpisy = (n) => `${n} ${plural(n, 'wpis', 'wpisy', 'wpisów')}`;

const polyline = (pts) => pts.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
const dots = (pts) => pts.map(([x, y]) => `M${x.toFixed(1)},${y.toFixed(1)}h.01`).join('');
function bandPath(seg, y) {
  if (seg.length < 2) return '';
  const up = seg.map((p) => `${px(p.i).toFixed(1)},${y(p.hi).toFixed(1)}`);
  const down = seg.map((p) => `${px(p.i).toFixed(1)},${y(p.lo).toFixed(1)}`).reverse();
  return `M${up.join('L')}L${down.join('L')}Z`;
}

function useWide(onNarrow) {
  const cb = useRef(onNarrow);
  useEffect(() => { cb.current = onNarrow; });
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const f = () => { if (!mq.matches) cb.current(); };
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
}

function Axis({ xs }) {
  const ticks = layoutLabels(xs.map((d, k) => ({
    key: d, x: px(k), prio: k === N - 1 ? 3 : k === 0 ? 2 : 1, text: k === N - 1 ? 'dziś' : ddmm(d), strong: k === N - 1,
  })).filter((t, k) => k === 0 || k === N - 1 || weekday(xs[k]) === 'pon.'), W, { rows: 1 });
  return (
    <div className="sp-axis" aria-hidden="true">
      {ticks.map((t) => <span key={t.key} className={`sp-lbl ${t.side}${t.strong ? ' strong' : ''}`} style={t.side === 'c' ? { left: `${(t.x / W) * 100}%` } : undefined}>{t.text}</span>)}
    </div>
  );
}

// jeden objaw: nagłówek (nazwa, kierunek skali, wartość wybranego dnia) i wykres 72 px na skali 0–10
function Panel({ s, d, sel }) {
  const H = 72, y = (v) => 70 - 6.8 * v;
  const trend = trendOf(d.tr);
  const at = sel ?? d.last;
  const v = at != null && at >= 0 ? d.vals[at] : null;
  const label = `${s.label}, 30 dni, skala 0–10: ${wpisy(d.count)}${d.lastTrend ? `, ostatnio ${d.vals[d.last]}, zakres z 7 dni ${num(d.lastTrend.lo, 1)}–${num(d.lastTrend.hi, 1)}` : d.last != null ? `, ostatnio ${d.vals[d.last]}` : ''}`;
  return (
    <div className="sp-panel">
      <div className="sp-head">
        <div className="sp-id"><b className={dn(s)}>{s.label}</b><span>0 = {s.low}, 10 = {s.high}</span>{trend && <span className="pill-trend" title={trend.title}>{trend.text}</span>}</div>
        <span className="sp-val" aria-hidden="true">{v ?? '–'}</span>
      </div>
      {d.count === 0 ? <p className="sp-none">Brak wpisów w ostatnich 30 dniach.</p> : (
        <>
          {!d.segs.length && <Empty kind="few" min="4 w ciągu 7 dni" className="sp-fewnote" />}
          <div className="sp-plot">
            <svg className="sym-chart sp-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
              <line className="sp-grid" x1="0" x2={W} y1={y(5)} y2={y(5)} />
              <line className="sp-base" x1="0" x2={W} y1="70.5" y2="70.5" />
              {sel != null && <line className="sp-cross" x1={px(sel)} x2={px(sel)} y1="0" y2="70" />}
              {d.segs.map((g, k) => g.length > 1 && <path key={k} className="sp-band" d={bandPath(g, y)} />)}
              <path className="sp-raw" d={dots(d.vals.map((x, i) => x != null && [px(i), y(x)]).filter(Boolean))} />
              {d.segs.map((g, k) => <path key={k} className="sp-line" d={polyline(g.map((p) => [px(p.i), y(p.mean)]))} />)}
            </svg>
            {v != null && <i className="sp-end" style={{ left: pct(at), top: y(v) }} aria-hidden="true" />}
          </div>
        </>
      )}
    </div>
  );
}

// zużycie suszu: osobny panel i osobna skala (g dziennie), bez porównania z objawami
function UsagePanel({ xs, use, sel }) {
  const H = 56, HMAX = 44;
  const max = Math.max(0, ...xs.map((d) => use[d] || 0));
  const top = niceTicks(max, 2).at(-1);
  const slot = W / N, bw = slot * 0.6;
  const at = sel ?? N - 1;
  const g = use[xs[at]] || 0;
  const total = xs.reduce((a, d) => a + (use[d] || 0), 0);
  return (
    <div className="sp-panel">
      <div className="sp-head">
        <div className="sp-id"><b>Zużycie suszu</b><span>{max > 0 ? `osobna skala, 0–${num(top)} g dziennie` : 'g dziennie, osobna skala'}</span></div>
        <span className="sp-val" aria-hidden="true">{sel == null && !g ? '–' : <span className="qty">{num(g)}<span className="unit">g</span></span>}</span>
      </div>
      {max === 0 ? <p className="sp-none">Nie zapisano zużycia suszu w ostatnich 30 dniach.</p> : (
        <div className="sp-plot sp-use">
          <Bars className="sym-chart sp-svg" width={W} height={H} slot={slot} x0={(slot - bw) / 2} bw={bw} hmax={HMAX} minH={3} max={top}
            preserveAspectRatio="none" role="img" aria-label={`Zużycie suszu, 30 dni, osobna skala: razem ${num(total)} g, najwięcej ${num(max)} g w jednym dniu`}
            items={xs.map((d) => ({ key: d, value: use[d] || 0 }))} groupClass={(d, k) => `sp-ubar${k === at && sel != null ? ' on' : ''}`}>
            <line className="sp-grid" x1="0" x2={W} y1={H - HMAX} y2={H - HMAX} />
            <line className="sp-base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
            {sel != null && <line className="sp-cross" x1={px(sel)} x2={px(sel)} y1="0" y2={H} />}
          </Bars>
        </div>
      )}
    </div>
  );
}

// widok „Razem” (komputer): wszystkie objawy na jednej skali 0–10, wyróżniony w --chart-data, reszta w --chart-ref
function Together({ list, data, focus, setFocus, sel, setSel }) {
  const H = 200, y = (v) => 192 - 18.4 * v;
  const have = list.filter((s) => data[s.key].count > 0);
  const f = have.find((s) => s.key === focus) ?? have[0];
  const endY = (s) => { const d = data[s.key], g = d.segs.at(-1); return g ? y(g.at(-1).mean) : y(d.vals[d.last]); };
  // podpisy końców linii: w dół bez nachodzenia, potem od dołu w granicach wykresu (H - 8)
  const ends = have.map((s) => ({ s, y: endY(s) })).sort((a, b) => a.y - b.y);
  for (let k = 0; k < ends.length; k++) ends[k].top = Math.max(ends[k].y, k ? ends[k - 1].top + 17 : -Infinity);
  for (let k = ends.length - 1; k >= 0; k--) ends[k].top = Math.min(ends[k].top, k < ends.length - 1 ? ends[k + 1].top - 17 : H - 8);
  const fd = data[f.key], at = sel ?? fd.last, fv = at != null ? fd.vals[at] : null;
  const line = (s, cls) => {
    const d = data[s.key];
    return d.segs.length
      ? d.segs.map((g, k) => <path key={`${s.key}${k}`} className={cls} d={polyline(g.map((p) => [px(p.i), y(p.mean)]))} />)
      : <path key={s.key} className="sp-refdot" d={dots(d.vals.map((x, i) => x != null && [px(i), y(x)]).filter(Boolean))} />;
  };
  return (
    <div>
      <div className="sp-focus" role="group" aria-label="Wyróżniony objaw">
        {have.map((s) => <button key={s.key} type="button" className={`chip${s.key === f.key ? ' on' : ''}${s.custom ? ' dn' : ''}`} aria-pressed={s.key === f.key} onClick={() => setFocus(s.key)}>{s.label}</button>)}
      </div>
      <div className="sp-tog">
        <div className="sp-yticks" aria-hidden="true">{[0, 5, 10].map((v) => <span key={v} style={{ top: y(v) }}>{v}</span>)}</div>
        <Scrub className="sp-scrub sp-together" n={N} sel={sel} onSel={setSel} role="group"
          label="Objawy z 30 dni na jednej skali 0–10. Strzałkami wybierzesz dzień.">
          <svg className="sym-chart sp-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
            aria-label={`Objawy razem, 30 dni, skala 0–10. Wyróżniony: ${f.label}, ${wpisy(fd.count)}.`}>
            {[0, 5, 10].map((v) => <line key={v} className={v ? 'sp-grid' : 'sp-base'} x1="0" x2={W} y1={y(v) + (v ? 0 : 0.5)} y2={y(v) + (v ? 0 : 0.5)} />)}
            {sel != null && <line className="sp-cross" x1={px(sel)} x2={px(sel)} y1="0" y2="192" />}
            {have.filter((s) => s !== f).map((s) => line(s, 'sp-ref'))}
            {fd.segs.map((g, k) => g.length > 1 && <path key={k} className="sp-band" d={bandPath(g, y)} />)}
            <path className="sp-raw" d={dots(fd.vals.map((x, i) => x != null && [px(i), y(x)]).filter(Boolean))} />
            {fd.segs.map((g, k) => <path key={k} className="sp-line" d={polyline(g.map((p) => [px(p.i), y(p.mean)]))} />)}
          </svg>
          {fv != null && <i className="sp-end" style={{ left: pct(at), top: y(fv) }} aria-hidden="true" />}
        </Scrub>
        <div className="sp-ends" aria-hidden="true">
          {ends.map(({ s, top }) => <span key={s.key} className={`${s.custom ? 'dn-img' : ''}${s === f ? ' on' : ''}`.trim() || undefined} style={{ top: top - 8 }}>{s.label}</span>)}
        </div>
      </div>
    </div>
  );
}

export default function SymptomsChart({ rows, usage, all, end }) {
  const [mode, setMode] = useState('osobno');
  const [focus, setFocus] = useState(null);
  const [sel, setSel] = useState(null);
  useWide(() => setMode('osobno'));

  const { xs, byDay, use, useMl, data, lastAny } = useMemo(() => {
    const xs = Array.from({ length: N }, (_, i) => addDays(end, -(N - 1 - i)));
    const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
    const use = Object.fromEntries(usage.map((u) => [u.day, Number(u.grams) || 0]));
    const useMl = Object.fromEntries(usage.map((u) => [u.day, Number(u.ml) || 0]));
    const data = {};
    for (const s of all) {
      const vals = xs.map((d) => (byDay[d]?.[s.key] != null ? Number(byDay[d][s.key]) : null));
      const tr = rolling(vals, WIN, MIN);
      let last = null;
      vals.forEach((v, i) => { if (v != null) last = i; });
      data[s.key] = { vals, tr, segs: segments(tr), count: vals.filter((v) => v != null).length, last, lastTrend: last != null ? tr[last] : null };
    }
    let lastAny = -1;
    xs.forEach((d, i) => { if (all.some((s) => data[s.key].vals[i] != null) || use[d] || useMl[d]) lastAny = i; });
    return { xs, byDay, use, useMl, data, lastAny };
  }, [rows, usage, all, end]);

  const hasSym = all.some((s) => data[s.key].count > 0);
  const i = Math.min(N - 1, sel ?? (lastAny >= 0 ? lastAny : N - 1));
  const day = xs[i];
  const parts = [
    ...all.filter((s) => data[s.key].vals[i] != null).map((s) => <Fragment key={s.key}><span className={dn(s)}>{s.short}</span> {data[s.key].vals[i]}</Fragment>),
    ...(use[day] > 0 ? [<Fragment key="g">zużycie {num(use[day], 1)} g</Fragment>] : []),
    ...(useMl[day] > 0 ? [<Fragment key="ml">{num(useMl[day], 1)} ml</Fragment>] : []),
  ];
  const read = (
    <><b>{day === end ? 'Dziś' : longDay(day)}:</b>{' '}
      {parts.length ? parts.map((p, k) => <Fragment key={k}>{k > 0 && ', '}{p}</Fragment>) : 'brak wpisów'}</>
  );
  const listed = xs.filter((d) => byDay[d] || use[d] || useMl[d]).reverse();
  const table = (
    <table>
      <caption>Wpisy objawów i zużycie z ostatnich 30 dni, od najnowszego</caption>
      <thead><tr><th scope="col">Dzień</th>{all.map((s) => <th key={s.key} scope="col">{s.label} (0–10)</th>)}<th scope="col">Zużycie</th></tr></thead>
      <tbody>
        {listed.length === 0 && <tr><td colSpan={all.length + 2}>Brak wpisów w ostatnich 30 dniach.</td></tr>}
        {listed.map((d) => (
          <tr key={d}><th scope="row">{d === end ? 'dziś' : longDay(d)}</th>
            {all.map((s) => <td key={s.key}>{byDay[d]?.[s.key] ?? 'nie wpisano'}</td>)}
            <td>{[use[d] > 0 && `${num(use[d], 1)} g`, useMl[d] > 0 && `${num(useMl[d], 1)} ml`].filter(Boolean).join(', ') || 'brak'}</td></tr>
        ))}
      </tbody>
    </table>
  );
  const scrubLabel = 'Objawy i zużycie z ostatnich 30 dni, każdy na osobnym wykresie. Strzałkami wybierzesz dzień.';

  return (
    <Frame className="sp" headClass="sp-readhead" readClass="sp-read" read={read} table={table}>
      {hasSym && (
        <div className="seg sp-mode" role="group" aria-label="Układ wykresów">
          {[['osobno', 'Osobno'], ['razem', 'Razem']].map(([k, t]) => <button key={k} type="button" className={mode === k ? 'on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>{t}</button>)}
        </div>
      )}
      {mode === 'razem' && hasSym ? (
        <>
          <Together list={all} data={data} focus={focus} setFocus={setFocus} sel={sel} setSel={setSel} xs={xs} />
          <UsagePanelWrap xs={xs} use={use} sel={sel} setSel={setSel} label={scrubLabel} />
        </>
      ) : (
        <Scrub className="sp-scrub" n={N} sel={sel} onSel={setSel} role="group" label={scrubLabel}>
          {hasSym
            ? all.map((s) => <Panel key={s.key} s={s} d={data[s.key]} sel={sel} />)
            : <p className="sp-none">Brak wpisów objawów w ostatnich 30 dniach.</p>}
          <UsagePanel xs={xs} use={use} sel={sel} />
          <Axis xs={xs} />
        </Scrub>
      )}
      <details className="sp-how">
        <summary>Jak czytać wykres</summary>
        <p className="sp-cap">
          {hasSym ? 'Kropki to wpisy. Linia to średnia z 7 dni, liczona tylko wtedy, gdy w tych 7 dniach są co najmniej 4 wpisy; pasmo to zakres z 7 dni (od najniższego do najwyższego wpisu). Linia nie łączy dni, między którymi są co najmniej 3 dni bez wpisu. ' : ''}
          Zużycie ma własną skalę i jest osobno.
        </p>
      </details>
    </Frame>
  );
}

// w widoku „Razem” panel zużycia ma własny Scrub (ta sama oś dni), bo pierwszy Scrub obejmuje tylko wykres objawów
function UsagePanelWrap({ xs, use, sel, setSel, label }) {
  return (
    <Scrub className="sp-scrub sp-usewrap" n={N} sel={sel} onSel={setSel} role="group" label={label}>
      <UsagePanel xs={xs} use={use} sel={sel} />
      <Axis xs={xs} />
    </Scrub>
  );
}
