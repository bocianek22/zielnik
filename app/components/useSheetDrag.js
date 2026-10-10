'use client';
import { useEffect, useRef } from 'react';

const CLOSE_PX = 80; // przeciągnięcie, od którego puszczenie zamyka arkusz
const FLICK = 0.5; // px/ms: szybki ruch w dół zamyka także przy krótszym przeciągnięciu

// Arkusz zamykany gestem w dół (uchwyt u góry nie jest tylko ozdobą). Dotyk zaczyna przeciąganie tylko wtedy,
// gdy arkusz jest przewinięty do góry, więc przewijanie długiej listy nie zamyka go przypadkiem.
// Klawiatura i czytnik ekranu dalej zamykają przez Escape i tło (useFocusTrap). Przy „ogranicz ruch” bez animacji powrotu.
export default function useSheetDrag(ref, active, onClose) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let y0 = 0, t0 = 0, dy = 0, drag = false, armed = false;
    const set = (y, animate) => {
      el.style.transition = animate && !reduce ? 'transform .2s cubic-bezier(.2, 0, 0, 1)' : 'none';
      el.style.transform = y ? `translateY(${y}px)` : '';
    };
    const start = (e) => {
      if (e.touches.length !== 1 || el.scrollTop > 0) { armed = false; return; }
      armed = true; drag = false; dy = 0;
      y0 = e.touches[0].clientY; t0 = Date.now();
    };
    const move = (e) => {
      if (!armed) return;
      const d = e.touches[0].clientY - y0;
      if (!drag && d < 6) { if (d < -2) armed = false; return; } // ruch w górę = zwykłe przewijanie
      drag = true;
      dy = Math.max(0, d);
      if (e.cancelable) e.preventDefault();
      set(dy, false);
    };
    const end = () => {
      if (!armed || !drag) { armed = false; return; }
      armed = false; drag = false;
      const fast = dy / Math.max(1, Date.now() - t0) > FLICK;
      if (dy > CLOSE_PX || (fast && dy > 24)) {
        set(reduce ? 0 : el.offsetHeight, true);
        setTimeout(() => closeRef.current?.(), reduce ? 0 : 160);
      } else set(0, true);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.style.transform = ''; el.style.transition = '';
    };
  }, [ref, active]);
}
