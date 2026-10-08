'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Icon from '../components/Icon';

const WHAT = { user: 'Profil', test: 'Test', strain: 'Odmiana', photo: 'Zdjęcie odmiany' };
const REASONS = { spam: 'Spam', ad: 'Reklama lub sprzedaż', abuse: 'Nękanie lub wyzwiska', privacy: 'Naruszenie prywatności', other: 'Inne' };

export default function ReportsAdmin({ onCount }) {
  const [reports, setReports] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (reports) onCount?.(reports.length); }, [reports, onCount]);
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
          <p>Gdy ktoś zgłosi profil, test, odmianę lub zdjęcie, pojawi się tutaj.</p>
        </div>
      ) : (
        <ul className="list">{reports.map((r) => (
          <li key={r.id} className="admin-report">
            <p className="admin-report-title">{REASONS[r.reason] || r.reason}</p>
            <p className="muted small">{WHAT[r.type] || r.type}{' '}{r.strain_name ? <><Link href={`/strains/${r.ref}`}>{r.strain_name}</Link>, autor:</> : 'użytkownika'}{' '}
              <Link href={`/u/${encodeURIComponent(r.target)}`}>@{r.target}</Link>. Zgłosił(a): {r.reporter || 'usunięty użytkownik'}, {r.at}</p>
            {r.note && <p className="admin-quote">Opis zgłaszającego: {r.note}</p>}
            {r.test_note && <p className="admin-quote">Treść testu: {r.test_note}</p>}
            <div className="admin-actions-bar">
              <button className="btn small" onClick={() => resolve(r.id, false)}>Zamknij zgłoszenie</button>
              {r.type === 'photo' && r.photo_exists && <button className="btn danger small" onClick={() => confirm('Usunąć zgłoszone zdjęcie odmiany?') && resolve(r.id, true)}>Usuń zdjęcie i zamknij</button>}
              {r.type === 'test' && r.ref && <button className="btn danger small" onClick={() => confirm('Usunąć zgłoszony test?') && resolve(r.id, true)}>Usuń test i zamknij</button>}
            </div>
          </li>))}</ul>)}
    </section>
  );
}
