'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDay } from '@/lib/date';
import { MEASURE_MAX, MEASURE_NAME_MAX, MEASURE_UNIT_MAX, fmtMeasure } from '@/lib/measures-meta';
import SecHead from '../components/SecHead';
import Toast from '../components/Toast';
import Icon from '../components/Icon';

const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
const HINTS = [['Tętno', 'ud./min'], ['Waga', 'kg'], ['Ciśnienie skurczowe', 'mmHg'], ['Ciśnienie rozkurczowe', 'mmHg'], ['Temperatura', '°C']];
const RECENT = 10;

// POM-63: własne pomiary z jednostką (do 3), jedna wartość dziennie. Bez norm, kolorów i ocen. Formularz wysyła tylko
// pola zmienione przez pacjenta, więc starszy dzień spoza listy nie traci zapisanej wartości po cichu.
export default function MeasuresLog({ initial }) {
  const [defs, setDefs] = useState(initial.defs);
  const [values, setValues] = useState(initial.values);
  const [day, setDay] = useState(todayIso());
  const [draft, setDraft] = useState({}); // id -> tekst wpisany przez pacjenta
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [manage, setManage] = useState(initial.defs.length === 0);

  const stored = (id) => values.find((v) => v.day === day && v.id === id);
  const shown = (id) => (id in draft ? draft[id] : stored(id) ? fmtMeasure(stored(id).value) : '');

  async function run(fn) {
    setBusy(true); setErr('');
    try { await fn(); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  }
  async function save(e) {
    e.preventDefault();
    const changed = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()]));
    if (!Object.keys(changed).length) { setMsg('Nic się nie zmieniło.'); return; }
    if (await run(async () => setValues((await api('/api/measures/values', 'PUT', { day, values: changed })).values))) {
      setDraft({}); setMsg('Zapisano pomiary.');
    }
  }
  async function add(n, u) {
    if (await run(async () => setDefs((await api('/api/measures', 'POST', { name: n, unit: u })).defs))) {
      setName(''); setUnit(''); setMsg('Dodano pomiar.');
    }
  }
  async function remove(d) {
    const n = values.filter((v) => v.id === d.id).length;
    if (!confirm(`Usunąć pomiar „${d.name}” razem ze wszystkimi zapisanymi wartościami${n ? ` (w ostatnich 30 dniach: ${n})` : ''}?`)) return;
    if (await run(async () => { const r = await api(`/api/measures/${d.id}`, 'DELETE'); setDefs(r.defs); setValues(r.values); })) {
      setDraft((p) => { const c = { ...p }; delete c[d.id]; return c; });
      setMsg('Usunięto pomiar.');
    }
  }

  const days = [...new Set(values.map((v) => v.day))].slice(0, RECENT);
  const have = new Set(defs.map((d) => d.name.toLowerCase()));
  const hints = HINTS.filter(([h]) => !have.has(h.toLowerCase()));
  const unitOf = (id) => defs.find((d) => d.id === id)?.unit;

  return (
    <section className="card stack measures" data-cat="journal" aria-labelledby="pomiary-h" id="pomiary">
      <SecHead cat="journal" icon="chart" id="pomiary-h">Pomiary</SecHead>
      <p className="muted small">Własne pomiary z jednostką, np. tętno, waga albo ciśnienie (skurczowe i rozkurczowe jako dwa pomiary). Jedna wartość dziennie, najwyżej {MEASURE_MAX} pomiary. Bez norm i ocen; w raporcie dla lekarza najmniejsza, średnia i największa wartość z okresu.</p>
      {defs.length > 0 && (
        <form className="stack" onSubmit={save}>
          <div className="field"><label htmlFor="ms-day">Dzień</label>
            <input id="ms-day" className="input" type="date" required max={todayIso()} value={day} onChange={(e) => { setDay(e.target.value); setDraft({}); }} /></div>
          {defs.map((d) => (
            <div key={d.id} className="field">
              <label htmlFor={`ms-v${d.id}`}><span className="dn">{d.name}</span>{d.unit && ` (${d.unit})`}</label>
              <input id={`ms-v${d.id}`} className="input" type="text" inputMode="decimal" autoComplete="off" maxLength={12}
                value={shown(d.id)} onChange={(e) => setDraft((p) => ({ ...p, [d.id]: e.target.value }))} placeholder="np. 72,5" />
            </div>
          ))}
          <p className="muted small">Wyczyszczone pole usuwa wartość z tego dnia.</p>
          <div><button className="btn" disabled={busy || !day}>Zapisz pomiary</button></div>
        </form>
      )}
      {err && <p className="alert error" role="alert">{err}</p>}
      {days.length > 0 && (
        <ul className="list measures-list" aria-label="Ostatnie pomiary">
          {days.map((dy) => (
            <li key={dy} className="list-row"><span className="lr-main"><b>{formatDay(dy)}</b>
              <span className="lr-sub">{values.filter((v) => v.day === dy).map((v) => (
                <span key={v.id} className="measure-val"><span className="dn">{defs.find((d) => d.id === v.id)?.name}</span> {fmtMeasure(v.value)}{unitOf(v.id) && ` ${unitOf(v.id)}`}</span>
              ))}</span></span></li>
          ))}
        </ul>
      )}
      <details className="measures-manage" open={manage} onToggle={(e) => setManage(e.currentTarget.open)}>
        <summary>{defs.length === 0 ? 'Dodaj pomiar' : 'Zarządzaj pomiarami'} <span className="muted small">({defs.length} z {MEASURE_MAX})</span></summary>
        {defs.length > 0 && (
          <ul className="list" aria-label="Moje pomiary">
            {defs.map((d) => (
              <li key={d.id} className="list-row">
                <span className="lr-main"><span className="dn">{d.name}</span>{d.unit && <span className="lr-sub">{d.unit}</span>}</span>
                <button type="button" className="btn text small danger" disabled={busy} onClick={() => remove(d)} aria-label={`Usuń pomiar: ${d.name}`}>Usuń</button>
              </li>
            ))}
          </ul>
        )}
        {defs.length < MEASURE_MAX ? (
          <>
            {hints.length > 0 && (
              <div className="chips" role="group" aria-label="Podpowiedzi pomiarów">
                {hints.map(([h, u]) => <button key={h} type="button" className="chip" disabled={busy} onClick={() => add(h, u)}><Icon name="plus" size={14} />{h} ({u})</button>)}
              </div>
            )}
            <form className="stack" onSubmit={(e) => { e.preventDefault(); add(name, unit); }}>
              <div className="row">
                <div className="field"><label htmlFor="ms-name">Nazwa</label>
                  <input id="ms-name" className="input" maxLength={MEASURE_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} placeholder="np. glukoza" /></div>
                <div className="field"><label htmlFor="ms-unit">Jednostka (opcjonalnie)</label>
                  <input id="ms-unit" className="input" maxLength={MEASURE_UNIT_MAX} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="np. mg/dl" /></div>
              </div>
              <div><button className="btn small" disabled={busy || !name.trim()}>Dodaj pomiar</button></div>
            </form>
          </>
        ) : <p className="muted small">Masz komplet. Usuń jeden pomiar, aby dodać inny.</p>}
      </details>
      <Toast text={msg} onClose={() => setMsg('')} />
    </section>
  );
}
