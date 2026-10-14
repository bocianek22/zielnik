'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDay } from '@/lib/date';
import { ADVERSE_NOTE_MAX, SEVERITIES, severityLabel } from '@/lib/adverse-meta';
import SecHead from '../components/SecHead';
import DictateButton from '../components/DictateButton';
import Toast from '../components/Toast';
import useUndoDelete from '../components/useUndoDelete';

const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());

// POM-62: dziennik zdarzeń niepożądanych. Dzień, nasilenie słowne i opis pacjenta (szyfrowany); bez wiązania z odmianą
// i bez podpowiedzi, co je wywołało. Stała, krótka informacja o 112 i zgłaszaniu, bez porad. Usunięcie z „Cofnij”.
export default function AdverseLog({ initial }) {
  const [events, setEvents] = useState(initial);
  const [day, setDay] = useState(todayIso());
  const [severity, setSeverity] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const undo = useUndoDelete();

  async function add(e) {
    e.preventDefault();
    if (!severity) { setErr('Wybierz nasilenie.'); e.currentTarget.querySelector('#ae-sev button')?.focus(); return; }
    setBusy(true); setErr('');
    try {
      setEvents((await api('/api/adverse', 'POST', { day, severity, note })).events);
      setNote(''); setSeverity('');
      setMsg('Zapisano zdarzenie.');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  async function remove(v) {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      setEvents((await api(`/api/adverse/${v.id}`, 'DELETE')).events);
      // nieczytelnego opisu nie da się odtworzyć, więc bez „Cofnij”
      if (v.noteLocked) setMsg('Usunięto zdarzenie.');
      else undo.offer('Usunięto zdarzenie.', async () => setEvents((await api('/api/adverse', 'POST', { day: v.day, severity: v.severity, note: v.note })).events));
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <section className="card stack adverse" data-cat="journal" aria-labelledby="zdarzenia-h" id="zdarzenia">
      <SecHead cat="journal" icon="alert" id="zdarzenia-h">Zdarzenia niepożądane</SecHead>
      <p className="muted small">Zapisz, jeśli pojawiło się coś niepokojącego, np. kołatanie serca, zawroty głowy albo silny niepokój. Opis jest szyfrowany i widzisz go tylko Ty. W raporcie dla lekarza jest data i nasilenie, a opis tylko po zaznaczeniu „Dołącz moje spostrzeżenia”.</p>
      <p className="alert note small">
        W nagłej sytuacji albo przy silnych objawach zadzwoń pod <a href="tel:112">112</a>. O działaniu niepożądanym możesz powiedzieć lekarzowi albo farmaceucie lub zgłosić je do URPL
        (<a href="https://urpl.gov.pl" target="_blank" rel="noopener noreferrer">urpl.gov.pl</a>). Aplikacja nie udziela porad medycznych.
      </p>
      <form className="stack" onSubmit={add}>
        <div className="field"><label htmlFor="ae-day">Data</label>
          <input id="ae-day" className="input" type="date" required max={todayIso()} value={day} onChange={(e) => setDay(e.target.value)} /></div>
        <div className="field">
          <span id="ae-sev-l" className="label">Nasilenie</span>
          <div id="ae-sev" className="seg" role="group" aria-labelledby="ae-sev-l">
            {SEVERITIES.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={severity === v} className={severity === v ? 'on' : ''} onClick={() => setSeverity(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="field"><label htmlFor="ae-note">Co się działo (opcjonalnie)</label>
          <textarea id="ae-note" className="input" rows={3} maxLength={ADVERSE_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
          <DictateButton value={note} onChange={setNote} max={ADVERSE_NOTE_MAX} /></div>
        <div><button className="btn" disabled={busy || !day}>Zapisz zdarzenie</button></div>
      </form>
      {err && <p className="alert error" role="alert">{err}</p>}
      {events.length > 0 && (
        <ul className="list adverse-list">
          {events.map((v) => (
            <li key={v.id} className="list-row">
              <span className="lr-main"><b>{formatDay(v.day)}</b><span className="lr-sub">Nasilenie: {severityLabel(v.severity)}</span>
                {v.note ? <span className="lr-sub dn adverse-note">{v.note}</span>
                  : v.noteLocked && <span className="lr-sub muted">Opis jest zaszyfrowany i chwilowo nieczytelny.</span>}</span>
              <button type="button" className="btn text small" disabled={busy} onClick={() => remove(v)} aria-label={`Usuń zdarzenie z ${formatDay(v.day)} (${severityLabel(v.severity)})`}>Usuń</button>
            </li>
          ))}
        </ul>
      )}
      {undo.error && <p className="alert error" role="alert">{undo.error}</p>}
      {undo.toast ? <Toast text={undo.toast.text} action={undo.toast.action} /> : <Toast text={msg} onClose={() => setMsg('')} />}
    </section>
  );
}
