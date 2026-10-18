'use client';
import { useEffect, useState } from 'react';
import { BADGES_SEEN_KEY, newBadges } from '@/lib/badges';

// UI 5 etap 5: jednorazowa informacja o nowej odznace („już pokazane” w localStorage tego urządzenia, czyszczone przy
// wylogowaniu). Przy pierwszym odczycie zdobyte zapamiętujemy po cichu, żeby nie było kilku gratulacji naraz.
// Animacja tylko przez CSS (.is-new), wyłączona przy „ogranicz ruch”.
export default function BadgeNews({ earned }) {
  const [fresh, setFresh] = useState([]);
  const keys = earned.map(([k]) => k).join(',');
  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem(BADGES_SEEN_KEY); } catch {}
    const r = newBadges(keys ? keys.split(',') : [], stored);
    try { localStorage.setItem(BADGES_SEEN_KEY, r.seen.join(',')); } catch {}
    for (const k of r.fresh) document.querySelector(`[data-badge="${k}"]`)?.classList.add('is-new');
    setFresh(r.fresh); // eslint-disable-line react-hooks/set-state-in-effect -- odczyt localStorage dopiero po stronie klienta
  }, [keys]);
  if (!fresh.length) return null;
  const names = earned.filter(([k]) => fresh.includes(k)).map(([, l]) => l);
  return <p className="badge-news" role="status">{names.length === 1 ? `Nowa odznaka: ${names[0]}` : `Nowe odznaki: ${names.join(', ')}`}</p>;
}
