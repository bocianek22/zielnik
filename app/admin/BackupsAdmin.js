'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Icon from '../components/Icon';

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
    <section className="admin-sec">
      <h2 className="section-label">Kopie zapasowe</h2>
      <p className="muted small admin-note">Co niedzielę baza zapisuje się automatycznie: z podłączonym magazynem Vercel Blob do prywatnego pliku poza bazą (12 tygodni, gzip, opcjonalnie szyfrowanie), inaczej do tabeli w bazie (8 ostatnich). Kopia zawiera dane tekstowe, bez haseł i zdjęć. Odtwarzanie jest ręczne; plik z Blob rozpakowuje scripts/backup-decrypt.js.</p>
      <div className="admin-actions-bar">
        <button className="btn" onClick={create} disabled={busy}>{busy ? 'Zapisuję…' : 'Utwórz kopię teraz'}</button>
        <a className="btn ghost" href="/api/backup"><Icon name="download" />Pobierz świeży zrzut</a>
      </div>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {backups && backups.length > 0 && (
        <ul className="list admin-log">
          {backups.map((b) => (
            <li key={b.id} className="list-row">
              <div className="lr-main">
                {b.at}
                <span className="lr-sub">{b.kind} · {Math.round(b.size / 1024).toLocaleString('pl-PL')} KB · {b.blob ? (b.encrypted ? 'Blob, szyfrowana' : 'Blob') : 'baza'}</span>
              </div>
              <a className="btn text small" href={`/api/backup?id=${b.id}`}>Pobierz</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
