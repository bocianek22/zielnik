'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATE = { ok: ['OK', 'ok'], missing: ['Brak', 'low'], weak: ['Słabe', 'low'] };
const CRONS = [['reminders', 'Przypomnienia push'], ['backup', 'Kopia zapasowa'], ['catalog', 'Katalog']];
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : 'brak zapisu');

// Lista kontrolna konfiguracji: tylko stan i wskazówka, serwer nie wysyła wartości zmiennych.
export default function ReadinessAdmin() {
  const [r, setR] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/admin/readiness').then(setR).catch((e) => setMsg(e.message)); }, []);
  if (msg) return <section className="admin-sec"><div className="alert error" role="alert">{msg}</div></section>;
  if (!r) return null;
  const todo = r.checks.filter((c) => !c.optional && c.state !== 'ok').length;
  return (
    <>
      <section className="admin-sec">
        <h2 className="section-label">Gotowość konfiguracji</h2>
        <p className="muted small admin-note">
          {todo ? `Do poprawy: ${todo}.` : 'Wszystkie wymagane pozycje są ustawione.'} Panel pokazuje tylko stan, nigdy wartości zmiennych. Zmiany robisz w Vercel (Settings, Environment Variables) i wdrażasz ponownie.
        </p>
        <ul className="list admin-log">
          {r.checks.map((c) => (
            <li key={c.id} className="list-row">
              <div className="lr-main">
                {c.label}{c.optional ? ' (opcjonalne)' : ''}
                <span className="lr-sub">{c.hint}</span>
              </div>
              <span className={`badge ${STATE[c.state][1]}`}>{STATE[c.state][0]}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="admin-sec">
        <h2 className="section-label">Działanie</h2>
        <dl className="stat-strip admin-stats">
          <div><dt>PostgreSQL</dt><dd><b>{r.postgres}</b></dd></div>
          <div><dt>Błędy serwera (24 h)</dt><dd><b>{r.errors24h.server}</b></dd></div>
          <div><dt>Błędy przeglądarki (24 h)</dt><dd><b>{r.errors24h.browser}</b></dd></div>
        </dl>
        <ul className="list admin-log">
          <li className="list-row"><div className="lr-main">Ostatnia kopia zapasowa<span className="lr-sub">{r.lastBackup ? `${fmt(r.lastBackup.at)} · ${r.lastBackup.kind} · ${r.lastBackup.blob ? 'Blob' : 'baza'}` : 'brak kopii'}</span></div></li>
          {CRONS.map(([k, l]) => <li key={k} className="list-row"><div className="lr-main">Ostatni przebieg: {l}<span className="lr-sub">{fmt(r.crons[k])}</span></div></li>)}
        </ul>
      </section>
    </>
  );
}
