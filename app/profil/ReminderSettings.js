'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const HOURS = [19, 20, 21, 22];
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;
// dziś wg czasu polskiego, jak po stronie serwera (parsePrefs)
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

// POM-05 / POM-15: wieczorne przypomnienie o wpisie objawów i przypomnienie o wizycie. Ustawienia zapisują się zawsze;
// powiadomienia zaczną przychodzić, gdy serwer ma klucze push, a to urządzenie jest zapisane w sekcji „Powiadomienia”.
export default function ReminderSettings() {
  const [cfg, setCfg] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState(null); // wersja robocza daty (null = brak edycji): zapis dopiero przy kompletnej dacie albo po opuszczeniu pola
  const seq = useRef(0); // numer ostatniego żądania: odpowiedzi nieaktualnych żądań są ignorowane

  useEffect(() => {
    api('/api/push/config').then((c) => { setCfg(c); setPrefs(c.prefs); }).catch((e) => setMsg(e.message));
  }, []);

  async function save(patch) {
    const id = ++seq.current;
    const prev = prefs;
    setPrefs((p) => ({ ...p, ...patch })); setMsg('');
    try {
      const r = await api('/api/push/prefs', 'PUT', patch);
      if (id !== seq.current) return; // nowsze żądanie już poszło: jego odpowiedź jest aktualna
      setPrefs((p) => ({ ...p, ...r.prefs })); setMsg('Zapisano.');
    } catch (e) {
      if (id !== seq.current) return;
      setPrefs((p) => ({ ...p, ...Object.fromEntries(Object.keys(patch).map((k) => [k, prev[k]])) }));
      setDraft(null); setMsg(e.message);
    }
  }

  // Data: onChange tylko aktualizuje pole. Zapis, gdy data jest kompletna (wybór z kalendarza; rok od 2000, żeby wpisywanie
  // roku cyfra po cyfrze nie wysyłało „0002-…”), albo po opuszczeniu pola (także puste = usunięcie daty).
  function changeVisit(v) {
    setDraft(v);
    if (FULL_DATE.test(v) && v >= '2000-01-01' && v !== (prefs.nextVisit || '')) save({ nextVisit: v });
  }
  function blurVisit() {
    const v = (draft ?? prefs.nextVisit) || null;
    setDraft(null);
    if (v !== (prefs.nextVisit || null)) save({ nextVisit: v });
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
            <input id="remind-visit" type="date" className="input" value={draft ?? prefs.nextVisit ?? ''} min={today()} disabled={!prefs.notifyVisit}
              onChange={(e) => changeVisit(e.target.value)} onBlur={blurVisit} />
          </div>
          <p className="muted small">Data wizyty jest widoczna tylko dla Ciebie. Po wizycie ustaw następną albo ją usuń.</p>
        </fieldset>
      ) : !msg && <p className="muted">Sprawdzanie…</p>}
      <span role="status" className="muted">{msg}</span>
    </section>
  );
}
