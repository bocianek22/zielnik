'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { todayPL, formatDay } from '@/lib/date';
import { openPrescriptions } from '@/lib/rx-match';

const nf = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2 });

// Recepty do wyboru przy „Wykupiłem” (POM-16): pobierane po otwarciu panelu; bez sieci albo błędu lista jest pusta,
// a serwer sam wybiera receptę (najbliższą wygaśnięcia z pozostałymi gramami).
export function useOpenPrescriptions(unit, enabled) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    api('/api/prescriptions').then((d) => { if (live) setList(openPrescriptions(d.prescriptions, unit, todayPL())); }).catch(() => {});
    return () => { live = false; };
  }, [unit, enabled]);
  return list;
}

// Mały wybór recepty, tylko gdy pasują co najmniej dwie (przy jednej serwer wybiera ją sam, bez dodatkowego kroku).
// value: undefined = domyślna (najbliższa wygaśnięcia), liczba = wybrana, null = bez recepty.
export default function RxPicker({ list, value, onChange, id }) {
  if (list.length < 2) return null;
  const shown = value === undefined ? String(list[0].id) : value === null ? '' : String(value);
  return (
    <div className="quick-more-row rx-picker">
      <label htmlFor={id}>Z której recepty</label>
      <select id={id} className="input" value={shown}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value) === list[0].id ? undefined : Number(e.target.value))}>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            zostało {nf(p.grams - p.bought)} {p.unit === 'ml' ? 'ml' : 'g'}{p.valid_until ? `, ważna do ${formatDay(p.valid_until)}` : ''}
          </option>
        ))}
        <option value="">bez recepty</option>
      </select>
    </div>
  );
}

// pole zapisu z wyboru: domyślna recepta = brak pola (wybiera serwer), null = bez recepty
export const rxField = (value) => (value === undefined ? {} : { prescriptionId: value });
