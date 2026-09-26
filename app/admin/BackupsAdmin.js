'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function BackupsAdmin() {
  const [backups, setBackups] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/admin/backups').then((r) => setBackups(r.backups)).catch((e) => setMsg(e.message)); }, []);
  async function create() {
    setBusy(true); setMsg('');
    try { setBackups((await api('/api/admin/backups', 'POST')).backups); } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  return (
    <section className="card">
      <h2>Kopie zapasowe</h2>
      <p className="muted">Co niedzielę baza zapisuje się automatycznie (przechowujemy 8 ostatnich). Kopia zawiera dane tekstowe, bez haseł i zdjęć. Odtwarzanie jest ręczne (plik JSON).</p>
      <div className="row">
        <button className="btn" onClick={create} disabled={busy}>{busy ? 'Zapisuję…' : 'Utwórz kopię teraz'}</button>
        <a className="btn ghost" href="/api/backup">Pobierz świeży zrzut</a>
      </div>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {backups && backups.length > 0 && (
        <div className="table-wrap"><table className="cmp"><thead><tr><th>Data</th><th>Rodzaj</th><th>Rozmiar</th><th /></tr></thead>
          <tbody>{backups.map((b) => (
            <tr key={b.id}><td>{b.at}</td><td>{b.kind}</td><td>{Math.round(b.size / 1024)} KB</td><td><a href={`/api/backup?id=${b.id}`}>Pobierz</a></td></tr>
          ))}</tbody></table></div>
      )}
    </section>
  );
}
