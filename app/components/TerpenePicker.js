'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

// Wybór terpenów jako "chipy" + dopisywanie własnych
export default function TerpenePicker({ options, value, onChange, onOptionsChange }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const toggle = (t) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);

  async function addNew() {
    if (!draft.trim()) return;
    setError('');
    try {
      const r = await api('/api/options', 'POST', { kind: 'terpene', value: draft });
      onOptionsChange(r.options);
      if (!value.includes(r.value)) onChange([...value, r.value]);
      setDraft('');
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="terp">
      <div className="chips" role="group" aria-label="Terpeny">
        {options.map((t) => (
          <button type="button" key={t} className={`chip ${value.includes(t) ? 'on' : ''}`} aria-pressed={value.includes(t)}
            onClick={() => toggle(t)}>{t}</button>
        ))}
      </div>
      <div className="optsel-add">
        <input className="input" placeholder="Dodaj nowy terpen" aria-label="Nowy terpen" value={draft} maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }} />
        <button type="button" className="btn small" onClick={addNew}>Dodaj</button>
      </div>
      {error && <p className="field-err" role="alert">{error}</p>}
    </div>
  );
}
