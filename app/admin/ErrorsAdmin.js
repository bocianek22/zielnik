'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ErrorsAdmin() {
  const [errors, setErrors] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/admin/errors').then((r) => setErrors(r.errors)).catch((e) => setMsg(e.message)); }, []);
  async function clear() {
    if (confirm('Wyczyścić dziennik błędów?')) setErrors((await api('/api/admin/errors', 'DELETE')).errors);
  }
  return (
    <section className="admin-sec">
      <h2 className="section-label">Dziennik błędów{errors?.length ? ` (${errors.length})` : ''}</h2>
      <p className="muted small admin-note">Ostatnie błędy serwera i przeglądarki (do 500). Kod (digest) pasuje do komunikatu, który widzi użytkownik, i do logów w Vercel.</p>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {errors && errors.length === 0 && <p className="muted">Brak zapisanych błędów.</p>}
      {errors && errors.length > 0 && (
        <>
          <ul className="list admin-log">
            {errors.map((e) => (
              <li key={e.id} className="list-row">
                <div className="lr-main">
                  <span className="admin-msg">{e.message}</span>
                  <span className="lr-sub">{e.source}{e.path ? ` · ${e.path}` : ''}{e.digest ? ` · kod ${e.digest}` : ''}</span>
                </div>
                <span className="lr-value admin-time">{e.at}</span>
              </li>
            ))}
          </ul>
          <div className="admin-danger">
            <button className="btn danger" onClick={clear}>Wyczyść dziennik błędów</button>
          </div>
        </>
      )}
    </section>
  );
}
