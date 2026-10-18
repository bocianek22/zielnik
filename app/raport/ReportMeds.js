'use client';
import { useEffect, useState } from 'react';
import { MEDS_EVENT } from './OtherMeds';

// Inne przyjmowane leki w arkuszu raportu (i na wydruku): stan z serwera, po zmianie w karcie z jej zdarzenia
export default function ReportMeds({ initial }) {
  const [meds, setMeds] = useState(initial);
  useEffect(() => {
    const on = (e) => setMeds(e.detail);
    window.addEventListener(MEDS_EVENT, on);
    return () => window.removeEventListener(MEDS_EVENT, on);
  }, []);
  if (meds.length === 0) return null;
  return (<><h3>Inne przyjmowane leki</h3>
    <ul className="report-notes report-meds">{meds.map((m) => <li key={m.id}>{m.name}{m.dose && ` – ${m.dose}`}</li>)}</ul></>);
}
