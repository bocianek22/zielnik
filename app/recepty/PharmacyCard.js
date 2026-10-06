'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QuickActions from '../components/QuickActions';
import { formatDay } from '@/lib/date';

const nf = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2 });

// POM-37: „W aptece” – jeden zwarty widok na wizytę: ile zostało na ważnych receptach (g i ml osobno) i co jest
// „do wykupienia” w pulach odmian, z „Wykupiłem”. Bez cen, aptek i porównań (POM-R4); nazwy odmian rozmyte w trybie dyskretnym.
export default function PharmacyCard({ rx, pools: initial }) {
  const [pools, setPools] = useState(initial);
  const router = useRouter();
  const active = rx.filter((r) => r.days_left >= 0);
  if (active.length === 0 && pools.length === 0) return null;
  // wykup zmienia też „zostało na recepcie”: odświeżamy dane serwera (karta) i listę recept poniżej
  const saved = (id) => (en) => {
    setPools((list) => list.map((p) => (p.id === id ? { ...p, current: en.current ?? p.current, remaining: en.remaining ?? p.remaining } : p)));
    router.refresh();
    window.dispatchEvent(new Event('zielnik:purchase'));
  };
  return (
    <section className="card pharmacy" aria-labelledby="pharmacy-h">
      <h2 id="pharmacy-h">W aptece</h2>
      {active.length > 0 && (
        <ul className="pharmacy-rx">
          {active.map((r) => (
            <li key={r.id}>
              <b>{nf(r.remaining)} {r.unit === 'ml' ? 'ml' : 'g'}</b> zostało na recepcie
              <span className="muted"> · ważna do {formatDay(r.valid_until)}{r.days_left <= 7 ? ` (${r.days_left === 0 ? 'dziś' : `${r.days_left} dni`})` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      {pools.length > 0 ? (
        <>
          <h3 className="section-label">Do wykupienia</h3>
          <ul className="pharmacy-pools">
            {pools.map((p) => (
              <li key={p.id} className="pharmacy-pool">
                <div className="pp-name">
                  <span className="dn">{p.name}</span>
                  {p.mates.length > 0 && <span className="muted small">albo <span className="dn">{p.mates.join(', ')}</span></span>}
                  <span className="muted small"><b>{nf(p.remaining)} {p.unit}</b> do wykupienia</span>
                </div>
                <QuickActions idPrefix="ph-" use={false} strainId={p.id} name={p.name} form={p.form} current={p.current}
                  remaining={p.remaining} onSaved={saved(p.id)} />
              </li>
            ))}
          </ul>
        </>
      ) : <p className="muted small">Nic nie czeka na wykupienie w Twoich odmianach.</p>}
    </section>
  );
}
