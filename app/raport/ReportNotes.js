'use client';
import { useEffect, useState } from 'react';

export const NOTES_EVENT = 'zielnik:doctor-notes';

// Punkty „Do omówienia” w arkuszu raportu (i na wydruku): stan z serwera, a po zmianie w karcie powyżej z jej zdarzenia,
// bez przeładowania strony.
export default function ReportNotes({ initial }) {
  const [open, setOpen] = useState(initial);
  useEffect(() => {
    const on = (e) => setOpen(e.detail);
    window.addEventListener(NOTES_EVENT, on);
    return () => window.removeEventListener(NOTES_EVENT, on);
  }, []);
  if (open.length === 0) return null;
  return (<><h3>Do omówienia</h3>
    <ul className="report-notes">{open.map((n) => <li key={n.id}>{n.text}</li>)}</ul></>);
}
