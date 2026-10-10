'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Kompaktowy pasek z nazwą ekranu (jak „large title” w iOS): na telefonie pojawia się, gdy pierwszy h1 w <main>
// zniknie pod górną krawędzią. Ekrany nic nie robią; krótszą nazwę podają przez data-short na h1.
// Tekst jest rysowany przez CSS z atrybutu (data-t), a pasek ma aria-hidden: nie dubluje tytułu dla czytnika ani testów.
// Nazwa odmiany w h1 (.dn) zostaje rozmyta także tutaj, w trybie dyskretnym.
export default function CompactTitle() {
  const path = usePathname();
  const [t, setT] = useState(null); // { text, dn } | null
  const [on, setOn] = useState(false);

  useEffect(() => {
    let io = null, cur = null;
    const bind = () => {
      const h = document.querySelector('main h1');
      if (h === cur) return;
      io?.disconnect(); io = null; cur = h;
      const text = (h?.dataset.short || h?.textContent || '').trim();
      if (!h || !text) { setT(null); setOn(false); return; }
      setT({ text, dn: h.matches('.dn') || !!h.querySelector('.dn') });
      io = new IntersectionObserver(([e]) => setOn(!e.isIntersecting && e.boundingClientRect.top < 0));
      io.observe(h);
    };
    bind();
    // h1 bywa dosyłany później albo podmieniany (szkielet loading.js -> strona, Suspense): wiążemy się z nowym
    const mo = new MutationObserver(() => { if (!cur || !cur.isConnected) bind(); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io?.disconnect(); mo.disconnect(); };
  }, [path]);

  if (!t) return null;
  const top = () => window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return (
    <div className={`cbar${on ? ' on' : ''}`} aria-hidden="true" onClick={top}>
      <span className={`cbar-t${t.dn ? ' dn' : ''}`} data-t={t.text} />
    </div>
  );
}
