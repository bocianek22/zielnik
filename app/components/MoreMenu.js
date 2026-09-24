'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Rozwijane menu "Więcej": zamyka się po przejściu na inną stronę i po kliknięciu poza nim
export default function MoreMenu({ children, badge }) {
  const ref = useRef(null);
  const path = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return (
    <details className="more" ref={ref}>
      <summary>Więcej{badge}</summary>
      <div className="more-menu">{children}</div>
    </details>
  );
}
