'use client';
import { useEffect } from 'react';

// Otwiera zwijaną sekcję (<details id="…">), gdy adres prowadzi do niej kotwicą: przy wejściu na stronę i po kliknięciu
// skrótu na tej samej stronie (hashchange). Nic nie renderuje.
export default function HashOpen() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id && document.getElementById(id);
      if (el && el.tagName === 'DETAILS') el.open = true;
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
