'use client';
// Wyspa klienta: owija wykres i obsługuje wybór przedziału palcem/myszą (najbliższy przedział) oraz klawiaturą
// (←/→, Home/End, Escape). Stan (`sel`, `onSel`) trzyma wywołujący, bo odczyt stoi w nagłówku wykresu (Frame), nie w dymku.
// `touch-action: pan-y` (CSS wywołującego) zostawia pionowe przewijanie strony; na myszy wyjście kursora czyści wybór.
export default function Scrub({ n, sel, onSel, className, label, children }) {
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSel(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))));
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
    <div className={className} tabIndex={0} role="img" aria-label={label} data-sel={sel ?? undefined}
      onPointerDown={pick} onPointerMove={pick}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') onSel(null); }} onKeyDown={onKey}>
      {children}
    </div>
  );
}
