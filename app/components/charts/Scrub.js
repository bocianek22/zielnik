'use client';
import { useRef } from 'react';
// Wyspa klienta: owija wykres i obsługuje wybór przedziału palcem/myszą (najbliższy przedział) oraz klawiaturą
// (←/→, Home/End, Escape). Stan (`sel`, `onSel`) trzyma wywołujący, bo odczyt stoi w nagłówku wykresu (Frame), nie w dymku.
// `role="group"` zamiast `img`, gdy w środku są własne wykresy z opisami (obraz zasłaniałby dzieci czytnikowi ekranu).
// `touch-action: pan-y` (CSS wywołującego) zostawia pionowe przewijanie strony; na myszy wyjście kursora czyści wybór.
// Na dotyku wybór dopiero przy ruchu w poziomie albo przy stuknięciu bez ruchu: przewijanie strony w pionie, zaczęte
// na wykresie, nie wybiera dnia; ponowne stuknięcie w wybrany przedział wraca do widoku domyślnego.
export default function Scrub({ n, sel, onSel, className, label, role = 'img', children }) {
  const touch = useRef(null);
  const at = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
  };
  const down = (e) => {
    if (e.pointerType === 'mouse') return onSel(at(e));
    touch.current = { x: e.clientX, y: e.clientY, h: false, moved: false };
  };
  const move = (e) => {
    const t = touch.current;
    if (e.pointerType === 'mouse') return onSel(at(e));
    if (!t) return;
    const dx = Math.abs(e.clientX - t.x), dy = Math.abs(e.clientY - t.y);
    if (!t.h && dx > 8 && dx > dy) t.h = true;
    if (dx > 8 || dy > 8) t.moved = true;
    if (t.h) onSel(at(e));
  };
  const up = (e) => {
    const t = touch.current;
    touch.current = null;
    if (e.pointerType === 'mouse' || !t || t.moved) return;
    const i = at(e);
    onSel(i === sel ? null : i);
  };
  const onKey = (e) => {
    const from = sel ?? n - 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onSel(Math.min(n - 1, Math.max(0, from + (e.key === 'ArrowLeft' ? -1 : 1))));
    } else if (e.key === 'Home') { e.preventDefault(); onSel(0); }
    else if (e.key === 'End') { e.preventDefault(); onSel(n - 1); }
    else if (e.key === 'Escape') onSel(null);
  };
  return (
    <div className={className} tabIndex={0} role={role} aria-label={label} data-sel={sel ?? undefined}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { touch.current = null; }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') onSel(null); }} onKeyDown={onKey}>
      {children}
    </div>
  );
}
