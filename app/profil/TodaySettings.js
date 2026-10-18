'use client';
import { useEffect, useRef, useState } from 'react';
import TodayLayout from '../components/TodayLayout';

// UI 5: ustawienia ekranu „Dziś” w profilu (wcześniej w „Szczegóły i ustawienia” na samym ekranie): układ kart na koncie
// i progi tylko na tym urządzeniu (te same klucze localStorage co HomeStore).
export default function TodaySettings({ initial }) {
  const [layout, setLayout] = useState(initial);
  // pola niekontrolowane: wartość z localStorage wpisujemy po montażu (serwer jej nie zna)
  const lowRef = useRef(null), limitRef = useRef(null);
  useEffect(() => {
    try {
      const v = (k, d) => { const x = localStorage.getItem(k) ?? d; return x === '0' ? '' : x; };
      if (lowRef.current) lowRef.current.value = v('zielnik.low', '3');
      if (limitRef.current) limitRef.current.value = v('zielnik.limit', '');
    } catch {}
  }, []);
  const save = (key) => (e) => { try { localStorage.setItem(key, e.target.value || '0'); } catch {} };
  return (
    <div className="stack">
      <TodayLayout layout={layout} onChange={setLayout} />
      <h3 className="prefs-title">Na tym urządzeniu</h3>
      <div className="row">
        <div className="field"><label htmlFor="pref-low">Próg „Kończy się” dla suszu (g)</label>
          <input id="pref-low" className="input" type="number" min="0" step="0.5" inputMode="decimal" ref={lowRef} onChange={save('zielnik.low')} /></div>
        <div className="field"><label htmlFor="pref-limit">Miesięczny limit wykupu suszu (g)</label>
          <input id="pref-limit" className="input" type="number" min="0" step="1" inputMode="numeric" ref={limitRef} onChange={save('zielnik.limit')} /></div>
      </div>
    </div>
  );
}
