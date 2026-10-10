'use client';
import { useEffect, useRef } from 'react';

// Okres „od ostatniej wizyty”: datę wpisuje pacjent, zostaje tylko na tym urządzeniu (localStorage).
// Zwykły formularz GET, więc działa też bez JavaScriptu; pole uzupełniamy po zamontowaniu bez stanu Reacta.
const VISIT_KEY = 'zielnik.lastVisit';

export default function VisitPeriod({ today, value, notes }) {
  const ref = useRef(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(VISIT_KEY);
      if (v && ref.current && !ref.current.value) ref.current.value = v;
    } catch {}
  }, []);
  const save = () => {
    try { const v = ref.current?.value; if (v) localStorage.setItem(VISIT_KEY, v); } catch {}
  };
  return (
    <form method="get" className="report-visit" onSubmit={save}>
      <div className="field">
        <label htmlFor="visit">Data ostatniej wizyty</label>
        <input ref={ref} id="visit" name="from" type="date" lang="pl" className="input" max={today} required defaultValue={value || undefined} />
      </div>
      <input type="hidden" name="to" value={today} />
      <input type="hidden" name="okres" value="wizyta" />
      {notes && <input type="hidden" name="notes" value="1" />}
      <button className="btn ghost">Od ostatniej wizyty</button>
      <p className="muted small">Datę zapamiętujemy tylko na tym urządzeniu.</p>
    </form>
  );
}
