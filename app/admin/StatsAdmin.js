'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const LABELS = [['users', 'Użytkownicy'], ['premium', 'Premium'], ['active7', 'Aktywni (7 dni)'], ['strains', 'Odmiany'], ['tests', 'Testy'],
  ['friendships', 'Znajomości'], ['groups', 'Grupy'], ['reports', 'Zgłoszenia'], ['open_invites', 'Zaproszenia']];

export default function StatsAdmin() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/api/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return null;
  return (
    <section className="admin-sec">
      <h2 className="section-label">Statystyki serwisu</h2>
      <div className="card summary">
        <dl className="stat-strip admin-stats">
          {LABELS.map(([k, l]) => <div key={k}><dt>{l}</dt><dd><b>{Number(s[k]).toLocaleString('pl-PL')}</b></dd></div>)}
        </dl>
      </div>
    </section>
  );
}
