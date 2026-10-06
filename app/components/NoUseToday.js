'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

// POM-38: „Dziś bez zużycia” jednym dotknięciem. Neutralnie: bez serii, liczników i zachęt; znacznik tylko odróżnia
// „nie użyłem” od „nie wpisałem” w „Moich obserwacjach”.
export default function NoUseToday({ day, initial = false }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function toggle() {
    setBusy(true); setErr('');
    try {
      await api('/api/usage/none', on ? 'DELETE' : 'POST', { day });
      setOn(!on);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div className="no-use">
      {on ? (
        <p className="muted small">Dziś oznaczone jako dzień bez zużycia.{' '}
          <button type="button" className="btn ghost small" onClick={toggle} disabled={busy}>Cofnij</button></p>
      ) : (
        <button type="button" className="btn ghost small" onClick={toggle} disabled={busy}
          aria-describedby="no-use-d">Dziś bez zużycia</button>
      )}
      {!on && <p id="no-use-d" className="muted small">Oznacz, jeśli dziś nic nie używasz: obserwacje odróżnią to od zapomnianego wpisu.</p>}
      {err && <p className="alert error" role="alert">{err}</p>}
    </div>
  );
}
