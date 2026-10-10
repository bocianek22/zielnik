'use client';
import { useState } from 'react';

// Liczba, która po zmianie wartości na chwilę podświetla tło (B4): zapas po „Zużyłem”, „Wykupiłem” itp. Przy pierwszym
// renderze nic się nie dzieje. Bez licznika animowanego: sama zmiana tła (system.css, `.bump`), wyłączona przy „ogranicz ruch”.
// Klucz elementu zmienia się razem z wartością, więc animacja startuje od nowa także przy kolejnej zmianie z rzędu.
export default function Bump({ value, as: Tag = 'b', children, className = '' }) {
  const [seen, setSeen] = useState({ value, n: 0 });
  let cur = seen;
  if (!Object.is(seen.value, value)) { cur = { value, n: seen.n + 1 }; setSeen(cur); } // zmiana stanu w renderze: wzorzec z dokumentacji Reacta
  return <Tag key={cur.n} className={`${cur.n ? 'bump' : ''}${className ? ` ${className}` : ''}` || undefined}>{children}</Tag>;
}
