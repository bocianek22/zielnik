'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KINDS } from '@/lib/kinds';
import { unitOf } from '@/lib/units';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { parseNum, decimalProps } from '../components/num';

const TAU = Math.PI * 2;
const dec = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 1 });
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');

// Kolory z tokenów motywu (canvas nie widzi zmiennych CSS), odczytywane przy każdym rysowaniu, więc zmiana motywu działa
function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const t = (n) => cs.getPropertyValue(n).trim();
  return {
    a: t('--surface-2'), b: t('--surface-3'), c: t('--bg'), text: t('--text'), gap: t('--surface'), ring: t('--sep-strong'),
    kind: { indica: t('--kind-indica'), sativa: t('--kind-sativa'), hybryda: t('--kind-hybryda') }, none: t('--text-3'),
  };
}

function draw(cv, items, rot) {
  const hide = document.documentElement.dataset.discreet === '1'; // tryb dyskretny: na kole tylko numery
  const k = tokens();
  const size = cv.clientWidth, dpr = window.devicePixelRatio || 1;
  cv.width = cv.height = size * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const c = size / 2, R = c - 4, n = items.length, a = TAU / n;
  const fs = Math.max(12, Math.min(17, (TAU * R * 0.65) / n * 0.6));
  const font = getComputedStyle(cv).fontFamily || 'sans-serif';
  items.forEach((it, i) => {
    const a0 = rot + i * a, a1 = rot + (i + 1) * a;
    // przy nieparzystej liczbie ostatni segment sąsiadowałby z pierwszym tym samym tłem: dostaje trzeci odcień
    g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a1); g.closePath();
    g.fillStyle = n % 2 === 1 && i === n - 1 ? k.c : i % 2 === 0 ? k.a : k.b; g.fill();
    g.strokeStyle = k.gap; g.lineWidth = 2; g.stroke();
    // rodzaj odmiany jako cienki łuk przy krawędzi (znacznik danych)
    g.beginPath(); g.arc(c, c, R - 3, a0 + 0.012, a1 - 0.012); g.strokeStyle = k.kind[it.kind] || k.none; g.lineWidth = 6; g.stroke();
    g.save(); g.translate(c, c); g.rotate(a0 + a / 2);
    g.font = `600 ${fs}px ${font}`; g.fillStyle = k.text; g.textAlign = 'right'; g.textBaseline = 'middle';
    let t = hide ? `Pozycja ${i + 1}` : it.name; const max = R - 66;
    while (g.measureText(t).width > max && t.length > 3) t = t.slice(0, -2);
    g.fillText(hide || t === it.name ? t : t + '…', R - 16, 0);
    g.restore();
  });
  g.beginPath(); g.arc(c, c, R, 0, TAU); g.strokeStyle = k.ring; g.lineWidth = 1.5; g.stroke();
}

export default function Wheel({ items: all }) {
  const cv = useRef(null);
  const rot = useRef(-Math.PI / 2);
  const [winner, setWinner] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [kind, setKind] = useState('');
  const [minThc, setMinThc] = useState('');
  const items = useMemo(
    () => all.filter((i) => (!kind || i.kind === kind) && (!(parseNum(minThc) >= 0) || (i.thc != null && i.thc >= parseNum(minThc)))),
    [all, kind, minThc],
  );

  useEffect(() => {
    if (!items.length) return;
    const paint = () => draw(cv.current, items, rot.current);
    paint();
    window.addEventListener('resize', paint);
    // zmiana motywu (ręczna lub systemu) i trybu dyskretnego przemalowuje koło
    const mo = new MutationObserver(paint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-discreet'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', paint);
    return () => { window.removeEventListener('resize', paint); mo.disconnect(); mq.removeEventListener('change', paint); };
  }, [items]);

  function spin() {
    if (spinning || !items.length) return;
    setWinner(null); setSpinning(true);
    const n = items.length, a = TAU / n;
    const rnd = crypto.getRandomValues(new Uint32Array(2));
    const w = rnd[0] % n;                              // zwycięzca wybrany losowo z crypto
    const offset = (rnd[1] / 2 ** 32 - 0.5) * 0.7;     // losowe miejsce w obrębie segmentu
    const target = -Math.PI / 2 - (w + 0.5 + offset) * a; // wskaźnik na górze
    const start = rot.current;
    const delta = ((target - start) % TAU + TAU) % TAU + TAU * (5 + (rnd[0] % 3));
    const dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 4800;
    const t0 = performance.now();
    (function frame(now) {
      const p = Math.min(1, (now - t0) / dur);
      rot.current = start + delta * (1 - Math.pow(1 - p, 3));
      draw(cv.current, items, rot.current);
      if (p < 1) requestAnimationFrame(frame);
      else { setSpinning(false); setWinner(items[w]); }
    })(t0);
  }

  if (!all.length) {
    return (
      <EmptyState art="jar" cat="strain" title="Koło jest puste" action={<Link href="/odmiany" className="btn">Przejdź do odmian</Link>}>
        Na kole pojawiają się odmiany, których Twój stan („Mam teraz”) jest większy od 0. Uzupełnij stany na liście odmian.
      </EmptyState>
    );
  }

  const pick = (v) => { setKind(v); setWinner(null); };
  const filters = (
    <div className="wh-tools">
      <div className="seg" role="group" aria-label="Rodzaj">
        {[['', 'Wszystkie'], ...KINDS.map((k) => [k.value, k.label])].map(([v, l]) => (
          <button key={v || 'all'} type="button" aria-pressed={kind === v} className={kind === v ? 'on' : ''} onClick={() => pick(v)}>{l}</button>
        ))}
      </div>
      <div className="sortbox">
        <label htmlFor="minthc">Minimalne THC (%)</label>
        <input id="minthc" className="input" {...decimalProps} value={minThc}
          onChange={(e) => { setMinThc(e.target.value); setWinner(null); }} />
      </div>
    </div>
  );

  const wheel = (
    <div className="wheel-wrap">
      <div className="wheel-box">
        <div className="wheel-pointer" aria-hidden="true" />
        <canvas ref={cv} className="wheel-canvas" role="img" aria-label={`Koło z ${items.length} odmianami`} />
        <button type="button" className="wheel-hub" onClick={spin} disabled={spinning} aria-label="Zakręć kołem">
          <Icon name="shuffle" size={22} />
          <span>{spinning ? '…' : 'Kręć'}</span>
        </button>
      </div>
      <div className="wheel-side" aria-live="polite">
        {winner ? (
          <>
            <h2 className="section-label">Wylosowano</h2>
            <ul className="list">
              <li><Link href={`/strains/${winner.id}`} className="list-row wheel-result">
                <span className="lr-main"><b className="cat-name dn">{winner.name}</b>
                  <span className="lr-sub"><span className="dn">{winner.producer}</span>{winner.kind && <> · <span className={`kind kind-${winner.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(winner.kind)}</span></>}{winner.thc != null && <span className="num"> · THC {dec(winner.thc)}%</span>}</span></span>
                <span className="lr-value">{dec(winner.current)} {unitOf(winner.form)}<small>na stanie</small></span>
                <Icon name="chevronRight" size={20} className="lr-chev" /></Link></li>
            </ul>
            <button type="button" className="btn ghost wheel-again" onClick={spin} disabled={spinning}>Losuj jeszcze raz</button>
          </>
        ) : (
          <p className="muted wheel-hint"><span className="num">{items.length}</span> {items.length === 1 ? 'odmiana' : items.length % 10 >= 2 && items.length % 10 <= 4 && (items.length % 100 < 12 || items.length % 100 > 14) ? 'odmiany' : 'odmian'} z zapasem większym od 0. Naciśnij środek koła, żeby wylosować, czego spróbować dziś.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="wh">
      {filters}
      {items.length ? wheel : (
        <EmptyState art="search" cat="strain" title="Brak odmian dla tych filtrów">Zmień rodzaj lub obniż minimalne THC.</EmptyState>
      )}
    </div>
  );
}
