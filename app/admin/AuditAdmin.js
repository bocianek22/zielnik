'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AuditAdmin() {
  const [entries, setEntries] = useState(null);
  useEffect(() => { api('/api/admin/audit').then((r) => setEntries(r.entries)).catch(() => {}); }, []);
  if (!entries) return null;
  return (
    <section className="admin-sec">
      <h2 className="section-label">Dziennik działań administratora</h2>
      <p className="muted small admin-note">Ostatnie 1000 działań (zaproszenia, plany, zgłoszenia). To rejestr działań, nie logowań.</p>
      {entries.length === 0 ? <p className="muted">Brak wpisów.</p> : (
        <ul className="list admin-log">
          {entries.map((e) => (
            <li key={e.id} className="list-row">
              <div className="lr-main">
                {e.action}
                <span className="lr-sub">{e.actor}{e.target ? ` · ${e.target}` : ''}</span>
              </div>
              <span className="lr-value admin-time">{e.at}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
