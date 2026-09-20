'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const REASONS = { spam: 'Spam', ad: 'Reklama lub sprzedaż', abuse: 'Nękanie lub wyzwiska', privacy: 'Naruszenie prywatności', other: 'Inne' };

export default function ReportsAdmin() {
  const [reports, setReports] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/admin/reports').then((r) => setReports(r.reports)).catch((e) => setMsg(e.message)); }, []);
  async function resolve(id, deleteContent) {
    try { setReports((await api('/api/admin/reports', 'POST', { id, deleteContent })).reports); } catch (e) { setMsg(e.message); }
  }
  return (
    <section className="card">
      <h2>Zgłoszenia {reports?.length ? `(${reports.length})` : ''}</h2>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {reports === null ? <p className="muted">Ładuję…</p> : reports.length === 0 ? <p className="muted">Brak otwartych zgłoszeń.</p> : (
        <ul className="wall">{reports.map((r) => (
          <li key={r.id}>
            <p><b>{REASONS[r.reason] || r.reason}</b> · {r.type === 'test' ? 'test' : 'profil'} użytkownika{' '}
              <Link href={`/u/${encodeURIComponent(r.target)}`}>@{r.target}</Link> <span className="muted">zgłosił(a) {r.reporter || 'usunięty użytkownik'}, {r.at}</span></p>
            {r.note && <p className="detail-desc">Opis zgłaszającego: {r.note}</p>}
            {r.test_note && <p className="detail-desc">Treść testu: {r.test_note}</p>}
            <div className="row">
              <button className="btn small" onClick={() => resolve(r.id, false)}>Zamknij</button>
              {r.type === 'test' && r.ref && <button className="btn danger small" onClick={() => confirm('Usunąć zgłoszony test?') && resolve(r.id, true)}>Usuń test i zamknij</button>}
            </div>
          </li>))}</ul>)}
    </section>
  );
}
