'use client';
import { useEffect } from 'react';
import { isDiscreet, setDiscreet, REVEAL_MS } from '@/lib/discreet';

const HIDDEN_LABEL = 'Ukryta nazwa, dotknij, aby pokazać na 5 sekund';

// Tryb dyskretny: elementy .dn są rozmyte w CSS (html[data-discreet]); tu tylko odsłanianie dotknięciem
// i dostępność. Pierwsze dotknięcie odsłania i nie nawiguje, drugie działa jak zwykle.
export default function DiscreetGuard() {
  useEffect(() => {
    const timers = new WeakMap();
    let lastBrandTap = 0;
    const reveal = (el) => {
      el.dataset.dnOpen = '1';
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => { delete el.dataset.dnOpen; }, REVEAL_MS));
    };
    // czytniki ekranu: ukryta nazwa ma opis zamiast treści, a po odsłonięciu wraca prawdziwy tekst
    const label = () => {
      const on = isDiscreet();
      document.querySelectorAll('.dn').forEach((el) => {
        const hidden = on && !el.dataset.dnOpen;
        const native = el.matches('a,button');
        if (hidden && !el.dataset.dnLabelled) {
          el.dataset.dnLabelled = '1';
          el.setAttribute('aria-label', HIDDEN_LABEL);
          if (!native) { el.setAttribute('role', 'button'); el.tabIndex = 0; }
        } else if (!hidden && el.dataset.dnLabelled) {
          delete el.dataset.dnLabelled;
          el.removeAttribute('aria-label');
          if (!native) { el.removeAttribute('role'); el.removeAttribute('tabindex'); }
        }
      });
    };
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(label); };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-dn-open'] });
    window.addEventListener('zielnik:discreet', schedule);
    schedule();

    const onClick = (e) => {
      // szybkie ukrycie: dwa dotknięcia logo pod rząd przełączają tryb
      if (e.target.closest?.('.brand')) {
        const now = Date.now();
        if (now - lastBrandTap < 450) { e.preventDefault(); lastBrandTap = 0; setDiscreet(!isDiscreet()); return; }
        lastBrandTap = now;
      }
      if (!isDiscreet()) return;
      const dn = e.target.closest?.('.dn,.dn-img');
      if (dn && !dn.dataset.dnOpen) { e.preventDefault(); e.stopImmediatePropagation(); reveal(dn); } // także przed innymi nasłuchami capture (przejście ekranu w aplikacji)
    };
    const onKey = (e) => {
      const dn = e.target.closest?.('.dn,.dn-img');
      if (isDiscreet() && dn && !dn.dataset.dnOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); reveal(dn); }
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      mo.disconnect(); cancelAnimationFrame(raf);
      window.removeEventListener('zielnik:discreet', schedule);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);
  return null;
}
