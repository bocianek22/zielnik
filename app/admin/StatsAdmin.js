'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const LABELS = [['users', 'Użytkownicy'], ['premium', 'Premium'], ['active7', 'Aktywni (7 dni, zużycie)'], ['strains', 'Odmiany'], ['tests', 'Testy'],
  ['friendships', 'Znajomości'], ['groups', 'Grupy'], ['reports', 'Otwarte zgłoszenia'], ['open_invites', 'Aktywne zaproszenia']];

export default function StatsAdmin() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/api/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return null;
  return (
    <section className="card">
      <h2>Statystyki serwisu</h2>
      <div className="stats">{LABELS.map(([k, l]) => <div key={k} className="stat"><b>{s[k]}</b><span>{l}</span></div>)}</div>
    </section>
  );
}
