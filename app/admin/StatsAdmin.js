'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const LABELS = [['users', 'Użytkownicy'], ['premium', 'Premium'], ['active7', 'Aktywni (7 dni)'], ['strains', 'Odmiany'], ['tests', 'Testy'],
  ['friendships', 'Znajomości'], ['groups', 'Grupy'], ['reports', 'Zgłoszenia'], ['open_invites', 'Zaproszenia']];

const BETA = [['active7', 'Aktywne konta (7 dni)', ''], ['pctStrain', 'Z odmianą w pierwszych 7 dniach', '%'], ['pctPrescription', 'Z receptą w pierwszych 7 dniach', '%'], ['pctUsage', 'Ze zużyciem w pierwszych 7 dniach', '%']];

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
      {s.beta && (
        <>
          <h2 className="section-label">Wskaźniki bety</h2>
          <div className="card summary">
            <dl className="stat-strip admin-stats">
              {BETA.map(([k, l, u]) => <div key={k}><dt>{l}</dt><dd><b>{s.beta[k] == null ? 'ukryte' : `${Number(s.beta[k]).toLocaleString('pl-PL')}${u}`}</b></dd></div>)}
            </dl>
            <p className="muted small admin-note">
              Tylko liczby zbiorcze, bez kont admina. Wartość jest ukryta, gdy grupa liczy mniej niż {s.beta.minGroup} kont (ochrona przed rozpoznaniem osób).
              Odsetki dotyczą kont zarejestrowanych co najmniej 7 dni temu{s.beta.cohort != null ? ` (teraz ${s.beta.cohort})` : ''}.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
