'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ErrorsAdmin() {
  const [errors, setErrors] = useState(null);
  const [msg, setMsg] = useState('');
  const [alerts, setAlerts] = useState(null);
  const [alertMsg, setAlertMsg] = useState('');
  useEffect(() => { api('/api/admin/errors').then((r) => setErrors(r.errors)).catch((e) => setMsg(e.message)); }, []);
  useEffect(() => { api('/api/admin/alerts').then(setAlerts).catch(() => {}); }, []);
  async function testAlert() {
    setAlertMsg('');
    try {
      const { sent } = await api('/api/admin/alerts', 'POST');
      const say = (v) => (v === null ? 'wyłączony' : v ? 'wysłano' : 'błąd (szczegóły w dzienniku, źródło „alert”)');
      setAlertMsg(`Webhook: ${say(sent.webhook)}. E-mail: ${say(sent.email)}.`);
    } catch (e) { setAlertMsg(e.message); }
  }
  async function clear() {
    if (confirm('Wyczyścić dziennik błędów?')) setErrors((await api('/api/admin/errors', 'DELETE')).errors);
  }
  return (
    <section className="admin-sec">
      <h2 className="section-label">Dziennik błędów{errors?.length ? ` (${errors.length})` : ''}</h2>
      <p className="muted small admin-note">Ostatnie błędy serwera i przeglądarki (do 500). Kod (digest) pasuje do komunikatu, który widzi użytkownik, i do logów w Vercel.</p>
      {alerts && (
        <div className="row">
          <span className="muted small">
            Alerty (PLA-2): webhook {alerts.channels.webhook ? 'włączony' : 'wyłączony'}, e-mail {alerts.channels.email ? 'włączony' : 'wyłączony'}; próg {alerts.threshold} błędów w 15 min oraz nowy rodzaj błędu.
          </span>
          {(alerts.channels.webhook || alerts.channels.email) && <button type="button" className="btn ghost small" onClick={testAlert}>Wyślij alert próbny</button>}
          <span role="status" className="muted small">{alertMsg}</span>
        </div>
      )}
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
