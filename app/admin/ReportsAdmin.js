'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Icon from '../components/Icon';

const WHAT = { user: 'Profil', test: 'Test', strain: 'Odmiana', photo: 'Zdjęcie odmiany', message: 'Wiadomość w czacie grupy' };
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
          <p>Gdy ktoś zgłosi profil, test, odmianę, zdjęcie lub wiadomość z czatu, pojawi się tutaj.</p>
        </div>
      ) : (
        <ul className="list">{reports.map((r) => (
          <li key={r.id} className="admin-report">
            <p className="admin-report-title">{REASONS[r.reason] || r.reason}</p>
            <p className="muted small">{WHAT[r.type] || r.type}{' '}{r.strain_name ? <><Link href={`/strains/${r.ref}`}>{r.strain_name}</Link>, autor:</> : 'użytkownika'}{' '}
              <Link href={`/u/${encodeURIComponent(r.target)}`}>@{r.target}</Link>. Zgłosił(a): {r.reporter || 'usunięty użytkownik'}, {r.at}</p>
            {r.note && <p className="admin-quote">Opis zgłaszającego: {r.note}</p>}
            {r.message_snapshot && <p className="admin-quote">Treść w chwili zgłoszenia{r.message_group ? ` (grupa „${r.message_group}”)` : ''}: {r.message_snapshot}</p>}
            {r.message_body && (!r.message_snapshot || r.message_changed) && <p className="admin-quote">{r.message_snapshot ? 'Treść teraz (zmieniona po zgłoszeniu)' : 'Treść wiadomości'}{!r.message_snapshot && r.message_group ? ` (grupa „${r.message_group}”)` : ''}: {r.message_body}</p>}
            {r.type === 'message' && r.message_changed && !r.message_exists && <p className="muted">Autor usunął wiadomość po zgłoszeniu.</p>}
            {r.test_note && <p className="admin-quote">Treść testu: {r.test_note}</p>}
            <div className="admin-actions-bar">
              <button className="btn small" onClick={() => resolve(r.id, false)}>Zamknij zgłoszenie</button>
              {r.type === 'photo' && r.photo_exists && <button className="btn danger small" onClick={() => confirm('Usunąć zgłoszone zdjęcie odmiany?') && resolve(r.id, true)}>Usuń zdjęcie i zamknij</button>}
              {r.type === 'message' && r.message_exists && <button className="btn danger small" onClick={() => confirm('Usunąć zgłoszoną wiadomość?') && resolve(r.id, true)}>Usuń wiadomość i zamknij</button>}
              {r.type === 'test' && r.ref && <button className="btn danger small" onClick={() => confirm('Usunąć zgłoszony test?') && resolve(r.id, true)}>Usuń test i zamknij</button>}
            </div>
          </li>))}</ul>)}
    </section>
  );
}
