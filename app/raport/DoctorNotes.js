'use client';
import SecHead from '../components/SecHead';
import DictateButton from '../components/DictateButton';
import { useState } from 'react';
import { api } from '@/lib/api';
import { NOTES_EVENT } from './ReportNotes';
import Toast from '../components/Toast';
import useUndoDelete from '../components/useUndoDelete';

const MAX = 10, LEN = 200;

// POM-36: „Do omówienia z lekarzem” – krótkie punkty przed wizytą; nieomówione trafiają na wydruk raportu.
// Po wizycie punkt odhacza się jako omówiony (znika z wydruku) albo usuwa.
export default function DoctorNotes({ initial }) {
  const [notes, setNotes] = useState(initial);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const undo = useUndoDelete();
  const open = notes.filter((n) => !n.done), done = notes.filter((n) => n.done);
  const publish = (list) => window.dispatchEvent(new CustomEvent(NOTES_EVENT, { detail: list.filter((n) => !n.done) }));

  async function run(p) {
    setBusy(true); setErr('');
    try {
      const { notes: list } = await p;
      setNotes(list);
      publish(list);
      return true;
    } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  }
  async function add(e) {
    e.preventDefault();
    if (await run(api('/api/doctor-notes', 'POST', { text }))) setText('');
  }
  const toggle = (n) => run(api(`/api/doctor-notes/${n.id}`, 'PATCH', { done: !n.done }));
  // usunięcie od razu, „Cofnij” dodaje punkt z tym samym tekstem (i odhacza, jeśli był omówiony)
  async function remove(n) {
    if (!(await run(api(`/api/doctor-notes/${n.id}`, 'DELETE')))) return;
    undo.offer('Usunięto punkt.', async () => {
      const { notes: list } = await api('/api/doctor-notes', 'POST', { text: n.text });
      const back = n.done && list.find((x) => x.text === n.text && !x.done);
      const final = back ? (await api(`/api/doctor-notes/${back.id}`, 'PATCH', { done: true })).notes : list;
      setNotes(final); publish(final);
    });
  }

  return (
    <div className="card stack doctor-notes no-print" data-cat="learn" aria-labelledby="dn-h">
      <SecHead cat="learn" icon="clipboard" id="dn-h">Do omówienia z lekarzem</SecHead>
      {open.length > 0 && (
        <ul className="dn-list">
          {open.map((n) => (
            <li key={n.id}>
              <label className="check"><input type="checkbox" checked={false} disabled={busy} onChange={() => toggle(n)} aria-label={`Omówione: ${n.text}`} /> <span>{n.text}</span></label>
              <button type="button" className="btn ghost small" onClick={() => remove(n)} disabled={busy}>Usuń</button>
            </li>
          ))}
        </ul>
      )}
      {open.length < MAX ? (
        <>
        <form className="field-row" onSubmit={add}>
          <label htmlFor="dn-new" className="sr-only">Nowy punkt</label>
          <input id="dn-new" className="input" maxLength={LEN} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="np. zapytać o przedłużenie recepty" />
          <button className="btn small" disabled={busy || !text.trim()}>Dodaj</button>
        </form>
        <DictateButton value={text} onChange={setText} max={LEN} />
        </>
      ) : <p className="muted small">To już {MAX} punktów. Odhacz omówione albo usuń niepotrzebne.</p>}
      <p className="muted small">Nieomówione punkty są drukowane w raporcie. Po wizycie odhacz to, co omówione.</p>
      {done.length > 0 && (
        <details>
          <summary className="muted small">Omówione ({done.length})</summary>
          <ul className="dn-list">
            {done.map((n) => (
              <li key={n.id} className="dn-done">
                <label className="check"><input type="checkbox" checked disabled={busy} onChange={() => toggle(n)} aria-label={`Przywróć: ${n.text}`} /> <span>{n.text}</span></label>
                <button type="button" className="btn ghost small" onClick={() => remove(n)} disabled={busy}>Usuń</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {(err || undo.error) && <p className="alert error" role="alert">{err || undo.error}</p>}
      <Toast text={undo.toast?.text || ''} action={undo.toast?.action} />
    </div>
  );
}
