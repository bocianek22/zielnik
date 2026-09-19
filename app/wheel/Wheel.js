'use client';
import { useEffect, useRef, useState } from 'react';
import Leaf from '../components/Leaf';

const COLORS = [['#2f5b3a', '#fff'], ['#78a952', '#10230f'], ['#d9992b', '#2b1c02'], ['#7e6798', '#fff'], ['#1d3b27', '#fff'], ['#b9d68f', '#10230f']];
const TAU = Math.PI * 2;

function draw(cv, items, rot) {
  const size = cv.clientWidth, dpr = window.devicePixelRatio || 1;
  cv.width = cv.height = size * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const c = size / 2, R = c - 6, n = items.length, a = TAU / n;
  const fs = Math.max(11, Math.min(17, (TAU * R * 0.65) / n * 0.6));
  items.forEach((it, i) => {
    const [bg, fg] = COLORS[i % COLORS.length];
    g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, rot + i * a, rot + (i + 1) * a); g.closePath();
    g.fillStyle = bg; g.fill(); g.strokeStyle = '#fbfaf2'; g.lineWidth = 2; g.stroke();
    g.save(); g.translate(c, c); g.rotate(rot + (i + 0.5) * a);
    g.font = `600 ${fs}px sans-serif`; g.fillStyle = fg; g.textAlign = 'right'; g.textBaseline = 'middle';
    let t = it.name; const max = R - 62;
    while (g.measureText(t).width > max && t.length > 3) t = t.slice(0, -2);
    g.fillText(t === it.name ? t : t + '…', R - 14, 0);
    g.restore();
  });
  g.beginPath(); g.arc(c, c, R, 0, TAU); g.strokeStyle = '#1d3b27'; g.lineWidth = 6; g.stroke();
}

export default function Wheel({ items }) {
  const cv = useRef(null);
  const rot = useRef(-Math.PI / 2);
  const [winner, setWinner] = useState(null);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!items.length) return;
    const paint = () => draw(cv.current, items, rot.current);
    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
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

  if (!items.length) {
    return (
      <div className="card empty">
        <h2>Koło jest puste</h2>
        <p className="muted">Na kole pojawiają się odmiany, których Twój stan („Mam teraz”) jest większy od 0. Uzupełnij stany na liście odmian.</p>
      </div>
    );
  }

  return (
    <div className="wheel-wrap">
      <div className="wheel-box">
        <div className="wheel-pointer" aria-hidden="true" />
        <canvas ref={cv} className="wheel-canvas" role="img" aria-label={`Koło z ${items.length} odmianami`} />
        <button className="wheel-hub" onClick={spin} disabled={spinning} aria-label="Zakręć kołem">
          <Leaf size={34} />
          <span>{spinning ? '…' : 'Kręć'}</span>
        </button>
      </div>
      <div className="card wheel-side" aria-live="polite">
        {winner ? (
          <>
            <p className="muted">Wylosowano</p>
            <h2>{winner.name}</h2>
            <p className="strain-meta"><span>{winner.producer}</span><span className="badge">{winner.type}</span></p>
            <p>Masz jeszcze <b>{winner.current} g</b>.</p>
            <button className="btn ghost small" onClick={spin} disabled={spinning}>Losuj jeszcze raz</button>
          </>
        ) : (
          <>
            <p className="muted">Na kole: {items.length} {items.length === 1 ? 'odmiana' : 'odmian'} z zapasem większym od 0.</p>
            <p>Naciśnij środek koła, żeby wylosować, czego spróbować dziś.</p>
          </>
        )}
      </div>
    </div>
  );
}
