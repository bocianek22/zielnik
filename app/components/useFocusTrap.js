'use client';
import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// stos aktywnych pułapek: Tab i Escape obsługuje tylko ostatnio otwarta (np. blokada PIN nad formularzem)
const stack = [];

function focusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
}

// Okienko modalne dla klawiatury i czytnika ekranu (WCAG 2.1.2, 2.4.3): fokus wchodzi do środka, Tab krąży po okienku,
// Escape wywołuje onClose (gdy podano), a po zamknięciu fokus wraca tam, gdzie był przed otwarciem.
export default function useFocusTrap(ref, active, onClose) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return undefined;
    const prev = document.activeElement;
    if (!root.contains(prev)) {
      const first = focusables(root)[0];
      if (first) first.focus();
      else { root.tabIndex = -1; root.focus(); }
    }
    const me = {};
    stack.push(me);
    const onKey = (e) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === 'Escape' && closeRef.current) { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables(root);
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const cur = document.activeElement;
      if (!root.contains(cur)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && cur === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(me), 1);
      if (prev instanceof HTMLElement && prev.isConnected) prev.focus();
    };
  }, [ref, active]);
}
