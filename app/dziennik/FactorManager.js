'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { FACTOR_MAX, FACTOR_NAME_MAX, FACTOR_HINTS } from '@/lib/factors-meta';
import Icon from '../components/Icon';

// Czynniki dnia (POM-47): lista własnych etykiet (do 8), dodanie z podpowiedzi albo własnej nazwy, usunięcie razem
// ze znacznikami. Same znaczniki zaznacza się w formularzu wpisu dnia (chipy).
export default function FactorManager({ factors, onChange }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run(fn, done) {
    setErr(null); setBusy(true);
    try { await fn(); await onChange(done); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  }
  const add = async (n) => { if (await run(() => api('/api/factors', 'POST', { name: n }), 'Dodano czynnik.')) setName(''); };
  const remove = (f) => {
    if (!confirm(`Usunąć czynnik „${f.name}” razem z jego zaznaczeniami?`)) return;
    run(() => api(`/api/factors/${f.id}`, 'DELETE'), 'Usunięto czynnik.');
  };
  const have = new Set(factors.map((f) => f.name.toLowerCase()));
  const hints = FACTOR_HINTS.filter((h) => !have.has(h)).slice(0, 6);
  return (
    <details className="card factor-manager" data-cat="journal" open={factors.length > 0 || undefined}>
      <summary><span className="ic-dot sm" data-cat="journal"><Icon name="zap" size={18} /></span><span className="lr-main">{factors.length === 0 ? 'Dodaj czynniki dnia' : 'Czynniki dnia'}<span className="lr-sub">{factors.length} z {FACTOR_MAX}</span></span><Icon name="chevronRight" size={18} className="lr-chev" /></summary>
      <p className="muted small">Czynniki to krótkie etykiety tego, co działo się danego dnia (np. stres, ruch, kofeina). Zaznaczasz je przy wpisie dnia, a w „Moich obserwacjach” zobaczysz średnie objawów w dniach z nimi i bez nich. Są prywatne.</p>
      {factors.length > 0 && (
        <ul className="list" aria-label="Czynniki dnia">
          {factors.map((f) => (
            <li key={f.id} className="list-row factor-manager-row">
              <span className="lr-main dn">{f.name}</span>
              <button type="button" className="btn text small danger" disabled={busy} onClick={() => remove(f)} aria-label={`Usuń czynnik: ${f.name}`}>Usuń</button>
            </li>
          ))}
        </ul>
      )}
      {factors.length < FACTOR_MAX && (
        <>
          {hints.length > 0 && (
            <div className="chips" role="group" aria-label="Podpowiedzi czynników">
              {hints.map((h) => <button key={h} type="button" className="chip" disabled={busy} onClick={() => add(h)}><Icon name="plus" size={14} />{h}</button>)}
            </div>
          )}
          <form className="field-row" onSubmit={(e) => { e.preventDefault(); add(name); }}>
            <label htmlFor="fx-new" className="sr-only">Nazwa nowego czynnika</label>
            <input id="fx-new" className="input" maxLength={FACTOR_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} placeholder="Własny czynnik, np. upał" />
            <button className="btn small" disabled={busy || !name.trim()}>Dodaj</button>
          </form>
        </>
      )}
      {factors.length >= FACTOR_MAX && <p className="muted small">Masz komplet. Usuń jeden czynnik, aby dodać inny.</p>}
      {err && <div className="alert error" role="alert">{err}</div>}
    </details>
  );
}
