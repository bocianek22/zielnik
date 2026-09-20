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
    <section className="card">
      <h2>Dziennik błędów {errors?.length ? `(${errors.length})` : ''}</h2>
      <p className="muted">Ostatnie błędy serwera i przeglądarki (przechowujemy do 500). Kod (digest) pasuje do komunikatu, który widzi użytkownik, i do logów w Vercel.</p>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {errors && errors.length === 0 && <p className="muted">Brak zapisanych błędów.</p>}
      {errors && errors.length > 0 && (
        <>
          <div className="table-wrap"><table className="cmp"><thead><tr><th>Czas</th><th>Źródło</th><th>Adres</th><th>Komunikat</th><th>Kod</th></tr></thead>
            <tbody>{errors.map((e) => (<tr key={e.id}><td>{e.at}</td><td>{e.source}</td><td>{e.path || '–'}</td><td>{e.message}</td><td>{e.digest || '–'}</td></tr>))}</tbody></table></div>
          <button className="btn ghost small" onClick={clear}>Wyczyść dziennik</button>
        </>
      )}
    </section>
  );
}
