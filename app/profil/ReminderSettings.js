'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const HOURS = [19, 20, 21, 22];

// POM-05 / POM-15: wieczorne przypomnienie o wpisie objawów i przypomnienie o wizycie. Ustawienia zapisują się zawsze;
// powiadomienia zaczną przychodzić, gdy serwer ma klucze push, a to urządzenie jest zapisane w sekcji „Powiadomienia”.
export default function ReminderSettings() {
  const [cfg, setCfg] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/api/push/config').then((c) => { setCfg(c); setPrefs(c.prefs); }).catch((e) => setMsg(e.message));
  }, []);

  async function save(patch) {
    const prev = prefs;
    setPrefs({ ...prefs, ...patch }); setMsg('');
    try { const r = await api('/api/push/prefs', 'PUT', patch); setPrefs((p) => ({ ...p, ...r.prefs })); setMsg('Zapisano.'); }
    catch (e) { setPrefs(prev); setMsg(e.message); }
  }

  return (
    <section className="card stack" aria-labelledby="remind-h">
      <h2 id="remind-h">Przypomnienia</h2>
      <p className="muted">Wyłączone, dopóki ich nie włączysz. Powiadomienie ma neutralną treść.</p>
      {cfg && !cfg.any && <p className="muted small" role="note">Powiadomienia nie są jeszcze włączone na serwerze. Ustawienia zapiszą się już teraz, a przypomnienia zaczną przychodzić, gdy administrator je skonfiguruje.</p>}
      {cfg?.any && prefs && !prefs.devices && <p className="muted small" role="note">Aby dostawać przypomnienia, włącz powiadomienia na tym urządzeniu w sekcji „Powiadomienia”.</p>}
      {prefs ? (
        <fieldset className="push-prefs" aria-label="Przypomnienia o wpisie i wizycie">
          <label className="switch-row"><span>Wieczorem, jeśli dziś nie ma wpisu objawów</span>
            <input type="checkbox" className="switch" role="switch" checked={prefs.notifySymptoms} onChange={(e) => save({ notifySymptoms: e.target.checked })} /></label>
          <div className="push-row">
            <label htmlFor="remind-hour">Godzina (czas polski)</label>
            <select id="remind-hour" className="input" value={prefs.symptomsHour} disabled={!prefs.notifySymptoms} onChange={(e) => save({ symptomsHour: Number(e.target.value) })}>
              {HOURS.map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
          {cfg && !cfg.hourly && <p className="muted small">Przypomnienie wieczorne wymaga, by serwer sprawdzał przypomnienia co godzinę. Na razie robi to raz dziennie rano, więc ten wybór zacznie działać po zmianie harmonogramu.</p>}
          <label className="switch-row"><span>Przed wizytą (dzień wcześniej i w dniu)</span>
            <input type="checkbox" className="switch" role="switch" checked={prefs.notifyVisit} onChange={(e) => save({ notifyVisit: e.target.checked })} /></label>
          <div className="push-row">
            <label htmlFor="remind-visit">Data wizyty</label>
            <input id="remind-visit" type="date" className="input" value={prefs.nextVisit || ''} disabled={!prefs.notifyVisit}
              onChange={(e) => save({ nextVisit: e.target.value || null })} />
          </div>
          <p className="muted small">Data wizyty jest widoczna tylko dla Ciebie. Po wizycie ustaw następną albo ją usuń.</p>
        </fieldset>
      ) : !msg && <p className="muted">Sprawdzanie…</p>}
      <span role="status" className="muted">{msg}</span>
    </section>
  );
}
