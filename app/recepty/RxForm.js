'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { parseNum, decimalProps } from '@/app/components/num';
import { todayPL } from '@/lib/date';

// Formularz nowej recepty: wspólny dla strony „Recepty” i kreatora pierwszego uruchomienia (POM-19).
// onAdded(prescriptions): lista recept z serwera po zapisie.
export default function RxForm({ onAdded }) {
  const [f, setF] = useState({ issuedOn: todayPL(), validUntil: '', grams: '', unit: 'g', note: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function add(e) {
    e.preventDefault();
    if (busy) return;
    const grams = parseNum(f.grams);
    if (!(grams > 0)) { setMsg(f.unit === 'ml' ? 'Podaj przepisaną ilość w ml, np. 30.' : 'Podaj przepisaną ilość w gramach, np. 10 lub 7,5.'); return; }
    setBusy(true);
    try {
      const r = await api('/api/prescriptions', 'POST', { ...f, grams });
      setF({ ...f, grams: '', note: '' }); setMsg('');
      onAdded(r.prescriptions);
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }

  return (
    <form className="stack" onSubmit={add} noValidate>
      <fieldset className="field rx-unit">
        <legend>Na co jest recepta</legend>
        <div className="seg" role="radiogroup" aria-label="Jednostka recepty">
          {[['g', 'Susz (g)'], ['ml', 'Olej lub pen (ml)']].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={f.unit === v} className={f.unit === v ? 'on' : ''}
              onClick={() => setF({ ...f, unit: v })}>{l}</button>
          ))}
        </div>
        <small className="muted">Wykupione liczymy tylko z zakupów w tej samej jednostce.</small>
      </fieldset>
      <div className="row">
        <div className="field grow"><label htmlFor="rx-from">Data wystawienia</label><input id="rx-from" className="input" type="date" required value={f.issuedOn} onChange={set('issuedOn')} /></div>
        <div className="field grow"><label htmlFor="rx-to">Ważna do (opcjonalnie)</label><input id="rx-to" className="input" type="date" value={f.validUntil} onChange={set('validUntil')} /></div>
        <div className="field grow"><label htmlFor="rx-g">Przepisana ilość ({f.unit})</label><input id="rx-g" className="input" {...decimalProps} required value={f.grams} onChange={set('grams')} /></div>
      </div>
      <div className="field"><label htmlFor="rx-n">Notatka (np. lekarz, numer)</label><input id="rx-n" className="input" maxLength={120} value={f.note} onChange={set('note')} /></div>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      <div><button className="btn" disabled={busy}>Dodaj receptę</button></div>
    </form>
  );
}
