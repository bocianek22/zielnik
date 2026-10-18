'use client';
import { useState } from 'react';
import SecHead from '../components/SecHead';
import Toast from '../components/Toast';
import useUndoDelete from '../components/useUndoDelete';
import { api } from '@/lib/api';

export const MEDS_EVENT = 'zielnik:other-meds';
const MAX = 15, LEN = 80;

// Inne przyjmowane leki (POM-39): ściąga dla lekarza, bez żadnej oceny leków ani interakcji (to byłaby porada medyczna).
// Do raportu (ReportMeds) i PDF trafia tylko po zaznaczeniu „Dołącz inne przyjmowane leki” (?leki=1); zmiana tutaj
// odświeża wtedy obie przez zdarzenie MEDS_EVENT.
export default function OtherMeds({ initial, included = false }) {
  const [meds, setMeds] = useState(initial);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const undo = useUndoDelete();
  const publish = (list) => window.dispatchEvent(new CustomEvent(MEDS_EVENT, { detail: list }));

  async function run(p) {
    setBusy(true); setErr('');
    try {
      const { meds: list } = await p;
      setMeds(list); publish(list);
      return true;
    } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  }
  async function add(e) {
    e.preventDefault();
    if (await run(api('/api/other-meds', 'POST', { name, dose }))) { setName(''); setDose(''); }
  }
  async function remove(m) {
    if (!(await run(api(`/api/other-meds/${m.id}`, 'DELETE')))) return;
    undo.offer('Usunięto lek.', async () => {
      const { meds: list } = await api('/api/other-meds', 'POST', { name: m.name, dose: m.dose });
      setMeds(list); publish(list);
    });
  }

  return (
    <div className="card stack other-meds no-print" data-cat="learn" aria-labelledby="om-h">
      <SecHead cat="learn" icon="shield" id="om-h">Inne przyjmowane leki</SecHead>
      {meds.length > 0 && (
        <ul className="dn-list">
          {meds.map((m) => (
            <li key={m.id}>
              <span>{m.name}{m.dose && <span className="muted"> · {m.dose}</span>}</span>
              <button type="button" className="btn ghost small" onClick={() => remove(m)} disabled={busy} aria-label={`Usuń lek: ${m.name}`}>Usuń</button>
            </li>
          ))}
        </ul>
      )}
      {meds.length < MAX ? (
        <form className="stack" onSubmit={add}>
          <div className="row">
            <div className="field"><label htmlFor="om-name">Nazwa leku</label>
              <input id="om-name" className="input" maxLength={LEN} value={name} onChange={(e) => setName(e.target.value)} placeholder="np. ibuprofen" autoComplete="off" /></div>
            <div className="field"><label htmlFor="om-dose">Dawkowanie (opcjonalnie)</label>
              <input id="om-dose" className="input" maxLength={LEN} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="np. 200 mg wieczorem" autoComplete="off" /></div>
          </div>
          <div><button className="btn small" disabled={busy || !name.trim()}>Dodaj lek</button></div>
        </form>
      ) : <p className="muted small">To już {MAX} leków. Usuń te, których już nie bierzesz.</p>}
      <p className="muted small">{included
        ? 'Lista jest dołączona do tego raportu (wydruk i PDF). '
        : 'Lista trafi do raportu i PDF, gdy zaznaczysz „Dołącz inne przyjmowane leki” w wyborze okresu. '}
        Zielnik nie ocenia leków ani ich połączeń; to tylko ściąga dla lekarza. Widzisz ją tylko Ty.</p>
      {(err || undo.error) && <p className="alert error" role="alert">{err || undo.error}</p>}
      <Toast text={undo.toast?.text || ''} action={undo.toast?.action} />
    </div>
  );
}
