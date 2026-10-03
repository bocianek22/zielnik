'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Icon from '../components/Icon';

const REASONS = { spam: 'Spam', ad: 'Reklama lub sprzedaż', abuse: 'Nękanie lub wyzwiska', privacy: 'Naruszenie prywatności', other: 'Inne' };

export default function ReportsAdmin() {
  const [reports, setReports] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/admin/reports').then((r) => setReports(r.reports)).catch((e) => setMsg(e.message)); }, []);
  async function resolve(id, deleteContent) {
    try { setReports((await api('/api/admin/reports', 'POST', { id, deleteContent })).reports); } catch (e) { setMsg(e.message); }
  }
  return (
    <section className="admin-sec">
      <h2 className="section-label">Zgłoszenia{reports?.length ? ` (${reports.length})` : ''}</h2>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {reports === null ? <p className="muted">Ładuję…</p> : reports.length === 0 ? (
        <div className="empty">
          <Icon name="shield" size={32} />
          <h2>Brak otwartych zgłoszeń</h2>
          <p>Gdy ktoś zgłosi profil lub test, pojawi się tutaj.</p>
        </div>
      ) : (
        <ul className="list">{reports.map((r) => (
          <li key={r.id} className="admin-report">
            <p className="admin-report-title">{REASONS[r.reason] || r.reason}</p>
            <p className="muted small">{r.type === 'test' ? 'Test' : 'Profil'} użytkownika{' '}
              <Link href={`/u/${encodeURIComponent(r.target)}`}>@{r.target}</Link>. Zgłosił(a): {r.reporter || 'usunięty użytkownik'}, {r.at}</p>
            {r.note && <p className="admin-quote">Opis zgłaszającego: {r.note}</p>}
            {r.test_note && <p className="admin-quote">Treść testu: {r.test_note}</p>}
            <div className="admin-actions-bar">
              <button className="btn small" onClick={() => resolve(r.id, false)}>Zamknij zgłoszenie</button>
              {r.type === 'test' && r.ref && <button className="btn danger small" onClick={() => confirm('Usunąć zgłoszony test?') && resolve(r.id, true)}>Usuń test i zamknij</button>}
            </div>
          </li>))}</ul>)}
    </section>
  );
}
