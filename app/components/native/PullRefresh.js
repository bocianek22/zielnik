'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { haptic } from './bridge';

const THRESHOLD = 68; // px pociągnięcia (po tłumieniu), od którego puszczenie odświeża
const MAX = 110;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Przeciągnij, aby odświeżyć (tylko aplikacja natywna): własna, lekka obsługa dotyku bez blokowania przewijania.
// Odświeża dane serwerowe (router.refresh) i prosi komponenty z własnym stanem o dociągnięcie danych:
// zdarzenie „zielnik:refresh” z detail.wait (tablica obietnic, do której komponent dopisuje swoje pobranie).
export default function PullRefresh() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);
  const busyRef = useRef(false);
  const el = useRef(null);
  useEffect(() => { pendingRef.current = pending; }, [pending]);

  useEffect(() => {
    const ind = el.current;
    let y0 = 0, x0 = 0, pull = 0, tracking = false;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const show = (p, animate) => {
      ind.style.transition = animate && !reduce ? 'transform .2s ease, opacity .2s ease' : 'none';
      ind.style.opacity = p > 4 ? '1' : '0';
      ind.style.transform = `translate(-50%, ${p - 48}px) rotate(${p * 4}deg)`;
    };
    // nie przechwytujemy gestu w polach, oknach, przewijanych kontenerach i elementach przypiętych do ekranu
    const blocked = (t) => {
      if (document.querySelector('[aria-modal="true"], .lightbox')) return true;
      for (let n = t; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
        if (n.matches?.('input, textarea, select, [contenteditable], [data-no-ptr]')) return true;
        const cs = getComputedStyle(n);
        if (cs.position === 'fixed') return true;
        if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) return true;
        if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth) return true;
      }
      return false;
    };
    const atTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;

    const onStart = (e) => {
      tracking = false;
      if (busyRef.current || e.touches.length !== 1 || !atTop() || blocked(e.target)) return;
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; pull = 0; tracking = true;
    };
    const onMove = (e) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - y0;
      const dx = e.touches[0].clientX - x0;
      if (!atTop() || dy <= 0 || (pull === 0 && Math.abs(dx) > Math.abs(dy))) { tracking = false; pull = 0; show(0, true); return; }
      const next = Math.min(MAX, dy * 0.5);
      if (pull < THRESHOLD && next >= THRESHOLD) haptic('light'); // próg osiągnięty: puszczenie odświeży
      pull = next;
      show(pull, false);
    };
    // przerwanie gestu przez system (touchcancel): bez odświeżania, tylko powrót wskaźnika
    const onCancel = () => { if (!tracking) return; tracking = false; pull = 0; show(0, true); };
    const onEnd = async () => {
      if (!tracking) return;
      tracking = false;
      if (pull < THRESHOLD) { pull = 0; show(0, true); return; }
      pull = 0;
      busyRef.current = true; setBusy(true);
      show(THRESHOLD * 0.75, true);
      haptic('refresh');
      const detail = { wait: [] };
      window.dispatchEvent(new CustomEvent('zielnik:refresh', { detail }));
      start(() => router.refresh());
      await Promise.allSettled(detail.wait);
      await sleep(700);
      for (let i = 0; i < 40 && pendingRef.current; i++) await sleep(100);
      busyRef.current = false; setBusy(false);
      show(0, true);
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, [router, start]);

  return (
    <div ref={el} className="ptr" aria-hidden="true" data-busy={busy ? '1' : undefined}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
