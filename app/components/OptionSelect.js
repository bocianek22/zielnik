'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const NEW = '__new__';

// Lista wyboru z możliwością dopisania nowej opcji (zapisywanej na stałe dla wszystkich)
export default function OptionSelect({ id, kind, options, value, onChange, onOptionsChange }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirmNew() {
    if (!draft.trim()) return;
    setBusy(true); setError('');
    try {
      const r = await api('/api/options', 'POST', { kind, value: draft });
      onOptionsChange(r.options);
      onChange(r.value);
      setAdding(false); setDraft('');
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="optsel">
      <select
        id={id}
        className="input"
        value={adding ? NEW : value}
        onChange={(e) => {
          if (e.target.value === NEW) setAdding(true);
          else { setAdding(false); onChange(e.target.value); }
        }}
      >
        {!value && <option value="" disabled>Wybierz…</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={NEW}>＋ Dodaj nową opcję…</option>
      </select>
      {adding && (
        <div className="optsel-add">
          <input
            className="input"
            autoFocus
            placeholder="Nowa opcja"
            value={draft}
            maxLength={40}
            aria-label="Nowa opcja"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmNew(); } }}
          />
          <button type="button" className="btn small" disabled={busy} onClick={confirmNew}>Dodaj</button>
          <button type="button" className="btn ghost small" onClick={() => { setAdding(false); setError(''); }}>Anuluj</button>
        </div>
      )}
      {error && <p className="field-err" role="alert">{error}</p>}
    </div>
  );
}
