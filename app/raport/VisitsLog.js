'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDay, addDaysIso, isIsoDay } from '@/lib/date';
import SecHead from '../components/SecHead';
import DictateButton from '../components/DictateButton';
import Toast from '../components/Toast';
import useUndoDelete from '../components/useUndoDelete';
import { VISIT_NOTE_MAX } from '@/lib/visits-meta';

const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
// następna wizyta: po dniu tej wizyty i nie w przeszłości (jak sprawdza serwer)
const nextMin = (day) => { const t = todayIso(); return isIsoDay(day) && day >= t ? addDaysIso(day, 1) : t; };

// POM-52: dziennik wizyt. Pacjent zapisuje datę i własną notatkę („co ustalono”); opcjonalnie datę następnej wizyty
// (trafia do przypomnień). Tylko dla właściciela, bez druku w raporcie; usunięcie z „Cofnij”.
export default function VisitsLog({ initial }) {
  const [visits, setVisits] = useState(initial);
  const [day, setDay] = useState(todayIso());
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const undo = useUndoDelete();

  async function add(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api('/api/visits', 'POST', { day, note, nextVisit: next || undefined });
      setVisits(r.visits); setNote(''); setNext('');
      setMsg(!next ? 'Zapisano wizytę.' : r.notifyVisit ? 'Zapisano wizytę i datę następnej w przypomnieniach.'
        : 'Zapisano wizytę i datę następnej. Przypomnienie o wizycie włączysz w profilu.');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  async function remove(v) {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      setVisits((await api(`/api/visits/${v.id}`, 'DELETE')).visits);
      // nieczytelnej notatki nie da się odtworzyć, więc bez „Cofnij” (odtworzenie zgubiłoby ją po cichu)
      if (v.noteLocked) setMsg('Usunięto wizytę.');
      else undo.offer('Usunięto wizytę.', async () => setVisits((await api('/api/visits', 'POST', { day: v.day, note: v.note })).visits));
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <section className="card stack visits no-print" data-cat="learn" aria-labelledby="wizyty-h" id="wizyty">
      <SecHead cat="learn" icon="calendar" id="wizyty-h">Wizyty</SecHead>
      <p className="muted small">Zapisz datę wizyty i to, co ustalono. Notatka jest szyfrowana i widzisz ją tylko Ty; nie trafia do wydruku raportu.</p>
      <form className="stack" onSubmit={add}>
        <div className="row">
          <div className="field"><label htmlFor="vi-day">Data wizyty</label>
            <input id="vi-day" className="input" type="date" required value={day} onChange={(e) => setDay(e.target.value)} /></div>
          <div className="field"><label htmlFor="vi-next">Następna wizyta (opcjonalnie)</label>
            <input id="vi-next" className="input" type="date" min={nextMin(day)} value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <div className="field"><label htmlFor="vi-note">Co ustalono (opcjonalnie)</label>
          <textarea id="vi-note" className="input" rows={3} maxLength={VISIT_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
          <DictateButton value={note} onChange={setNote} max={VISIT_NOTE_MAX} /></div>
        <div><button className="btn" disabled={busy || !day}>Zapisz wizytę</button></div>
      </form>
      {err && <p className="alert error" role="alert">{err}</p>}
      {visits.length > 0 && (
        <ul className="list visits-list">
          {visits.map((v) => (
            <li key={v.id} className="list-row">
              <span className="lr-main"><b>{formatDay(v.day)}</b>{v.note ? <span className="lr-sub dn visit-note">{v.note}</span>
                : v.noteLocked && <span className="lr-sub muted">Notatka jest zaszyfrowana i chwilowo nieczytelna.</span>}</span>
              <button type="button" className="btn text small" disabled={busy} onClick={() => remove(v)} aria-label={`Usuń wizytę z ${formatDay(v.day)}`}>Usuń</button>
            </li>
          ))}
        </ul>
      )}
      {undo.error && <p className="alert error" role="alert">{undo.error}</p>}
      {undo.toast ? <Toast text={undo.toast.text} action={undo.toast.action} /> : <Toast text={msg} onClose={() => setMsg('')} />}
    </section>
  );
}
