'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AuditAdmin() {
  const [entries, setEntries] = useState(null);
  useEffect(() => { api('/api/admin/audit').then((r) => setEntries(r.entries)).catch(() => {}); }, []);
  if (!entries) return null;
  return (
    <section className="card">
      <h2>Dziennik działań administratora</h2>
      <p className="muted">Ostatnie 1000 działań (zaproszenia, plany, zgłoszenia). Rejestr działań, nie logowań.</p>
      {entries.length === 0 ? <p className="muted">Brak wpisów.</p> : (
        <div className="table-wrap"><table className="cmp"><thead><tr><th>Czas</th><th>Kto</th><th>Co</th><th>Cel</th></tr></thead>
          <tbody>{entries.map((e) => (<tr key={e.id}><td>{e.at}</td><td>{e.actor}</td><td>{e.action}</td><td>{e.target || '–'}</td></tr>))}</tbody></table></div>
      )}
    </section>
  );
}
