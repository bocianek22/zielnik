'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import OptionSelect from './OptionSelect';

// Formularz pól wspólnych: producent, odmiana, typ, ocena końcowa, smak
export default function StrainForm({ strain, options, tastes, canDelete, onOptionsChange, onDone, onCancel }) {
  const [f, setF] = useState({
    producer: strain?.producer ?? '',
    name: strain?.name ?? '',
    type: strain?.type ?? '',
    finalRating: strain?.final_rating ?? '',
    taste: strain?.taste ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (strain) await api(`/api/strains/${strain.id}`, 'PATCH', f);
      else await api('/api/strains', 'POST', f);
      await onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Usunąć odmianę „${strain.name}” razem ze wszystkimi ocenami i stanami?`)) return;
    setBusy(true);
    try { await api(`/api/strains/${strain.id}`, 'DELETE'); await onDone(); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  const uid = strain ? `s${strain.id}` : 'new';
  return (
    <form className="card strain-form" onSubmit={submit}>
      <h2>{strain ? 'Edytuj odmianę' : 'Nowa odmiana'}</h2>
      <div className="row">
        <div className="field grow">
          <label htmlFor={`${uid}-producer`}>Producent</label>
          <OptionSelect id={`${uid}-producer`} kind="producer" options={options.producer} value={f.producer}
            onChange={set('producer')} onOptionsChange={onOptionsChange} />
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-name`}>Odmiana</label>
          <input id={`${uid}-name`} className="input" value={f.name} maxLength={60} required
            onChange={(e) => set('name')(e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div className="field grow">
          <label htmlFor={`${uid}-type`}>Typ</label>
          <OptionSelect id={`${uid}-type`} kind="type" options={options.type} value={f.type}
            onChange={set('type')} onOptionsChange={onOptionsChange} />
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-final`}>Ocena końcowa (0–10)</label>
          <input id={`${uid}-final`} className="input" type="number" min="0" max="10" step="0.5" inputMode="decimal"
            value={f.finalRating ?? ''} onChange={(e) => set('finalRating')(e.target.value)} />
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-taste`}>Smak</label>
          <input id={`${uid}-taste`} className="input" list={`${uid}-tastes`} value={f.taste} maxLength={120}
            placeholder="np. cytrusowy, ziemisty" onChange={(e) => set('taste')(e.target.value)} />
          <datalist id={`${uid}-tastes`}>{tastes.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="row form-actions">
        <button className="btn" disabled={busy}>{strain ? 'Zapisz zmiany' : 'Dodaj odmianę'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Anuluj</button>
        {strain && canDelete && (
          <button type="button" className="btn danger push-right" disabled={busy} onClick={remove}>Usuń odmianę</button>
        )}
      </div>
    </form>
  );
}
