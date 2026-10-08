'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Icon from '../components/Icon';

export default function BackupsAdmin() {
  const [backups, setBackups] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [password, setPassword] = useState('');
  useEffect(() => { api('/api/admin/backups').then((r) => setBackups(r.backups)).catch((e) => setMsg(e.message)); }, []);
  // Pobranie wymaga ponownego podania hasła admina (POST /api/backup); plik zapisujemy z odpowiedzi
  async function download(id) {
    if (!password) { setMsg('Wpisz hasło admina, aby pobrać kopię.'); return; }
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, id }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Nie udało się pobrać kopii.');
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'zielnik-kopia.json';
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPassword('');
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  async function create() {
    setBusy(true); setMsg('');
    try { setBackups((await api('/api/admin/backups', 'POST')).backups); } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  return (
    <section className="admin-sec">
      <h2 className="section-label">Kopie zapasowe</h2>
      <p className="muted small admin-note">Codziennie o 3:00 UTC baza zapisuje się automatycznie: z podłączonym magazynem Vercel Blob do prywatnego pliku poza bazą (12 tygodni, gzip, opcjonalnie szyfrowanie), inaczej do tabeli w bazie (8 ostatnich). Kopia zawiera dane tekstowe, bez haseł i zdjęć. Odtwarzanie jest ręczne; plik z Blob rozpakowuje scripts/backup-decrypt.js.</p>
      <div className="field">
        <label htmlFor="bk-pass">Hasło admina (wymagane do pobrania kopii)</label>
        <input id="bk-pass" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="admin-actions-bar">
        <button className="btn" onClick={create} disabled={busy}>{busy ? 'Pracuję…' : 'Utwórz kopię teraz'}</button>
        <button className="btn ghost" onClick={() => download()} disabled={busy}><Icon name="download" />Pobierz świeży zrzut</button>
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
              <button className="btn text small" onClick={() => download(b.id)} disabled={busy}>Pobierz</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
