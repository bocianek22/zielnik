'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { VERSION } from '@/lib/version';
import { newerThan } from '@/lib/whats-new';
import useFocusTrap from './useFocusTrap';

export const SEEN_VERSION_KEY = 'zielnik.seenVersion';

// „Co nowego” raz po aktualizacji: pamiętamy ostatnio widzianą wersję na urządzeniu. Pierwsze uruchomienie
// (brak zapisu) niczego nie pokazuje, tylko zapisuje wersję: nowe konto nie dostaje listy zmian, których nie zna.
// Pełna lista jest w Pomocy.
export default function WhatsNew() {
  const [list, setList] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_VERSION_KEY);
      if (!seen) { localStorage.setItem(SEEN_VERSION_KEY, VERSION); return; }
      const fresh = newerThan(seen, VERSION).slice(0, 3);
      if (fresh.length) {
        // pod ekranem blokady lub zgody okno czeka: dwie pułapki fokusu naraz myliłyby czytnik ekranu
        const locked = () => !!document.querySelector('.web-lock, .native-lock, .consent-gate');
        if (!locked()) { setList(fresh); return; }
        const t = setInterval(() => { if (!locked()) { clearInterval(t); setList(fresh); } }, 1000);
        return () => clearInterval(t);
      }
      else if (seen !== VERSION) localStorage.setItem(SEEN_VERSION_KEY, VERSION);
    } catch { /* zablokowane dane witryny: bez listy */ }
  }, []);
  const close = () => {
    try { localStorage.setItem(SEEN_VERSION_KEY, VERSION); } catch { /* jw. */ }
    setList(null);
  };
  useFocusTrap(ref, !!list, close);
  if (!list) return null;
  return (
    <>
      <div className="wn-backdrop" onClick={close} aria-hidden="true" />
      <section className="wn" role="dialog" aria-modal="true" aria-labelledby="wn-h" ref={ref}>
        <h2 id="wn-h">Co nowego</h2>
        {list.map((e) => (
          <div key={e.version}>
            <h3>Wersja {e.version}</h3>
            <ul>{e.items.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        ))}
        <div className="wn-actions">
          <button type="button" className="btn" onClick={close}>Rozumiem</button>
          <Link href="/pomoc#co-nowego" className="btn text" onClick={close}>Wszystkie zmiany</Link>
        </div>
      </section>
    </>
  );
}
