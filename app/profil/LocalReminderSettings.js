'use client';
import { useEffect, useState } from 'react';
import { LOCAL_HOURS } from '@/lib/local-reminders';
import { ensurePermission, getLocalSettings, localSupported, setLocalSettings, syncLocal } from '../components/localReminders';

// POM-49: przypomnienia planowane na tym telefonie (APK od 0.6.0): działają bez serwera push i bez crona co godzinę.
// Widoczne tylko w aplikacji z wtyczką. Treść neutralna; ustawienia nie wychodzą z telefonu.
export default function LocalReminderSettings() {
  const [ok, setOk] = useState(false);
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!localSupported()) return;
    setOk(true); // eslint-disable-line react-hooks/set-state-in-effect -- wtyczka istnieje dopiero w przeglądarce APK
    getLocalSettings().then(setS);
  }, []);
  if (!ok || !s) return null;

  async function update(patch) {
    const next = { ...s, ...patch };
    setMsg('');
    if ((patch.symptoms || patch.visit || patch.rx || patch.stock || patch.backup) && !(await ensurePermission())) {
      setMsg('Telefon nie pozwala na powiadomienia. Włącz je w ustawieniach systemu dla aplikacji Zielnik.');
      return;
    }
    setS(next);
    await setLocalSettings(next);
    try { await syncLocal({ settings: next }); setMsg('Zapisano na tym telefonie.'); } catch (e) { setMsg(e.message); }
  }

  return (
    <section className="card stack" aria-labelledby="localrem-h">
      <h2 id="localrem-h" className="section-title">Przypomnienia na tym telefonie</h2>
      <p className="muted small">Działają bez internetu i bez serwera powiadomień. Treść jest neutralna. Jeśli używasz też przypomnień z serwera, włącz tylko jedne, żeby nie dostawać podwójnych.</p>
      <label className="check"><input type="checkbox" checked={s.symptoms} onChange={(e) => update({ symptoms: e.target.checked })} /> Wieczorem, jeśli nie ma dziś wpisu w dzienniku</label>
      {s.symptoms && (
        <div className="field"><label htmlFor="lr-hour">Godzina</label>
          <select id="lr-hour" className="input" value={s.hour} onChange={(e) => update({ hour: Number(e.target.value) })}>
            {LOCAL_HOURS.map((h) => <option key={h} value={h}>{h}:00</option>)}
          </select></div>
      )}
      <label className="check"><input type="checkbox" checked={s.visit} onChange={(e) => update({ visit: e.target.checked })} /> Dzień przed wizytą (data z sekcji „Przypomnienia”)</label>
      <label className="check"><input type="checkbox" checked={s.rx} onChange={(e) => update({ rx: e.target.checked })} /> 3 dni przed końcem ważności recepty</label>
      <label className="check"><input type="checkbox" checked={s.stock} onChange={(e) => update({ stock: e.target.checked })} /> 2 dni przed końcem zapasu (według prognozy)</label>
      <label className="check"><input type="checkbox" checked={s.backup} onChange={(e) => update({ backup: e.target.checked })} /> Kopia danych co 30 dni (od ostatniej pobranej na tym telefonie)</label>
      <p className="muted small">Terminy recepty i zapasu telefon bierze z ekranu „Dziś”: przypomnienia aktualizują się, gdy go otworzysz.</p>
      {msg && <p className="muted small" role="status">{msg}</p>}
    </section>
  );
}
