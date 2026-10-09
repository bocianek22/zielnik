'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { SYMPTOMS, customMeta, CUSTOM_MAX, CUSTOM_NAME_MAX } from '@/lib/symptoms';
import Icon from '../components/Icon';
import Toast from '../components/Toast';
import SecHead from '../components/SecHead';
import SymptomsChart from '../components/charts/SymptomsChart';
import { addDays } from '../components/charts/fmt';

// Dzień w czasie polskim, a nie UTC (po północy toISOString dawało wczoraj). Do zamiany na todayPL z lib/date.js.
const dayPL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
const todayIso = () => dayPL.format(new Date());
const yesterdayIso = () => addDays(todayIso(), -1);

// Zarządzanie własnymi objawami (do 3): dodanie, zmiana nazwy i kierunku skali, usunięcie razem z wpisami
function CustomManager({ defs, onChange }) {
  const [name, setName] = useState('');
  const [better, setBetter] = useState(false);
  const [edit, setEdit] = useState(null); // { id, name, better }
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run(fn, done) {
    setErr(null); setBusy(true);
    try { await fn(); await onChange(done); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  }
  const add = async (e) => {
    e.preventDefault();
    if (await run(() => api('/api/symptoms/custom', 'POST', { name, higherBetter: better }), 'Dodano własny objaw.')) { setName(''); setBetter(false); }
  };
  const save = async (e) => {
    e.preventDefault();
    if (await run(() => api(`/api/symptoms/custom/${edit.id}`, 'PATCH', { name: edit.name, higherBetter: edit.better }), 'Zapisano zmiany.')) setEdit(null);
  };
  const remove = (d) => {
    if (!confirm(`Usunąć własny objaw „${d.name}” razem ze wszystkimi jego wpisami? Tego nie można cofnąć.`)) return;
    run(() => api(`/api/symptoms/custom/${d.id}`, 'DELETE'), 'Usunięto własny objaw i jego wpisy.');
  };
  const dirOptions = (id) => (
    <select id={id} className="input" value={String(edit ? edit.better : better)} onChange={(e) => (edit ? setEdit({ ...edit, better: e.target.value === 'true' }) : setBetter(e.target.value === 'true'))}>
      <option value="false">Wyżej = gorzej (np. nudności, spastyczność)</option>
      <option value="true">Wyżej = lepiej (np. apetyt, energia)</option>
    </select>
  );
  return (
    <details className="card sym-custom" data-cat="journal" open={defs.length > 0 || undefined}>
      <summary><span className="lr-main">{defs.length === 0 ? 'Dodaj własny objaw' : 'Własne objawy'}<span className="lr-sub">{defs.length} z {CUSTOM_MAX}</span></span><Icon name="chevronRight" size={18} className="lr-chev" /></summary>
      <p className="muted small">Dodaj do {CUSTOM_MAX} własnych objawów w skali 0–10. Pojawią się w formularzu, na wykresie, w obserwacjach i w raporcie dla lekarza. Są prywatne.</p>
      {defs.length > 0 && (
        <ul className="list" aria-label="Własne objawy">
          {defs.map((d) => (
            <li key={d.id} className="list-row sym-custom-row">
              {edit?.id === d.id ? (
                <form className="stack" onSubmit={save}>
                  <div className="field"><label htmlFor={`ce-n-${d.id}`}>Nazwa</label>
                    <input id={`ce-n-${d.id}`} className="input" maxLength={CUSTOM_NAME_MAX} required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                  <div className="field"><label htmlFor={`ce-d-${d.id}`}>Kierunek skali</label>{dirOptions(`ce-d-${d.id}`)}</div>
                  <div className="sym-actions"><button className="btn" disabled={busy}>Zapisz</button><button type="button" className="btn text" onClick={() => setEdit(null)}>Anuluj</button></div>
                </form>
              ) : (
                <>
                  <span className="lr-main"><span className="dn">{d.name}</span><span className="lr-sub">wyżej = {d.higherBetter ? 'lepiej' : 'gorzej'}</span></span>
                  <button type="button" className="btn text small" disabled={busy} onClick={() => { setErr(null); setEdit({ id: d.id, name: d.name, better: d.higherBetter }); }} aria-label={`Zmień: ${d.name}`}>Zmień</button>
                  <button type="button" className="btn text small danger" disabled={busy} onClick={() => remove(d)} aria-label={`Usuń: ${d.name}`}>Usuń</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {defs.length < CUSTOM_MAX && !edit && (
        <form className="stack" onSubmit={add}>
          <div className="field"><label htmlFor="cn-name">Nazwa nowego objawu</label>
            <input id="cn-name" className="input" maxLength={CUSTOM_NAME_MAX} required value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Nudności" /></div>
          <div className="field"><label htmlFor="cn-dir">Kierunek skali</label>{dirOptions('cn-dir')}</div>
          <div className="sym-actions"><button className="btn" disabled={busy || !name.trim()}>Dodaj objaw</button></div>
        </form>
      )}
      {defs.length >= CUSTOM_MAX && <p className="muted small">Masz komplet. Usuń jeden objaw, aby dodać inny.</p>}
      {err && <div className="alert error" role="alert">{err}</div>}
    </details>
  );
}

export default function SymptomsBoard() {
  const [data, setData] = useState({ rows: [], usage: [], custom: [], customValues: [] });
  const [day, setDay] = useState(todayIso());
  const [f, setF] = useState({ pain: '', sleep: '', anxiety: '', mood: '', note: '' });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => { api('/api/symptoms').then((d) => { setData(d); setLoaded(true); }).catch((e) => setMsg({ text: e.message, error: true })); }, []);
  // własne objawy (POM-07) traktujemy jak wbudowane: klucz c<id>, wartości dołączone do wierszy dni
  const defs = useMemo(() => data.custom ?? [], [data]);
  const all = useMemo(() => [...SYMPTOMS, ...defs.map(customMeta)], [defs]);
  const merged = useMemo(() => {
    const m = new Map(data.rows.map((r) => [r.day, { ...r }]));
    for (const v of data.customValues ?? []) { const r = m.get(v.day) ?? { day: v.day }; r[`c${v.id}`] = v.value; m.set(v.day, r); }
    return [...m.values()];
  }, [data]);
  const existing = useMemo(() => merged.find((r) => r.day === day), [merged, day]);
  useEffect(() => {
    setF({ pain: existing?.pain ?? '', sleep: existing?.sleep ?? '', anxiety: existing?.anxiety ?? '', mood: existing?.mood ?? '', note: existing?.note ?? '',
      ...Object.fromEntries(all.filter((x) => x.custom).map((x) => [x.key, existing?.[x.key] ?? ''])) });
  }, [existing, day, all]);
  const reload = () => api('/api/symptoms').then(setData);

  async function save(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const custom = Object.fromEntries(defs.map((d) => [d.id, f[`c${d.id}`] ?? '']));
    try { const d = await api('/api/symptoms', 'PUT', { day, ...f, ...(defs.length ? { custom } : {}) }); setData(d); setMsg(d.noteError ? { text: `Zapisano wartości. ${d.noteError}`, error: true } : { text: 'Zapisano.' }); if (day === todayIso()) focusNext.current = 'sym-today-h'; setEditing(false); } catch (err) { setMsg({ text: err.message, error: true }); }
    setSaving(false);
  }
  async function remove() {
    if (!confirm('Usunąć wpis z tego dnia?')) return;
    try { setData(await api('/api/symptoms', 'DELETE', { day })); setMsg({ text: 'Usunięto.' }); setEditing(false); } catch (err) { setMsg({ text: err.message, error: true }); }
  }

  const folded = loaded && existing && day === todayIso() && !editing;
  // fokus nie może zginąć, gdy zwijanie/rozwijanie odmontowuje element z fokusem (klawiatura, czytnik ekranu)
  const focusNext = useRef(null);
  useEffect(() => {
    const t = focusNext.current;
    if (!t) return;
    focusNext.current = null;
    document.getElementById(t)?.focus();
  }, [folded]);
  return (
    <div className="stack">
      <p className="priv-note"><Icon name="info" size={20} />Dziennik służy Twojej obserwacji i rozmowie z lekarzem. Dane są prywatne, a średnie z wybranego okresu trafiają do raportu dla lekarza.</p>
      <SecHead cat="journal" icon="chart">Ostatnie 30 dni</SecHead>
      {loaded && merged.length === 0 && data.usage.length === 0 ? (
        <section className="card empty">
          <Icon name="pulse" size={32} />
          <h2>Wykres pojawi się po pierwszym wpisie</h2>
          <p>Zapisz, jak się dziś czujesz. Po kilku dniach zobaczysz tu przebieg bólu, snu, lęku i nastroju.</p>
          <button type="button" className="btn" onClick={() => { const f = document.getElementById('sym-form'); f?.scrollIntoView({ block: 'start' }); f?.querySelector('input')?.focus({ preventScroll: true }); }}>Wpisz stan</button>
        </section>
      ) : !loaded ? (
        // przed pobraniem danych: miejsce zarezerwowane, bez fałszywego „brak wpisów” i bez skoku układu
        <section className="card sym-skel" aria-busy="true" aria-label="Wczytywanie wykresu" />
      ) : (
      <section className="card" data-cat="journal">
        <SymptomsChart rows={merged} usage={data.usage} all={all} end={todayIso()} />
      </section>
      )}
      <SecHead cat="journal" icon="edit">Wpis objawów</SecHead>
      {msg?.error && <div className="alert error" role="alert">{msg.text}</div>}
      <Toast text={msg && !msg.error ? msg.text : ''} onClose={() => setMsg(null)} />
      {folded ? (
      <section className="card tint sym-today" data-cat="journal" aria-labelledby="sym-today-h">
        <div className="sym-today-head">
          <span className="ic-dot sm"><Icon name="check" size={20} /></span>
          <h2 id="sym-today-h" tabIndex={-1}>Dziś: zapisano</h2>
          <button type="button" className="btn soft" onClick={() => { focusNext.current = 'sd'; setEditing(true); }}>Zmień</button>
        </div>
        {(() => {
          const v = all.filter((x) => existing[x.key] != null);
          if (!v.length) return <p className="small">Tylko notatka.</p>;
          return (
            <ul className="sym-tiles">
              {v.map((x) => <li key={x.key}><b>{existing[x.key]}</b><span className={x.custom ? 'dn' : undefined}>{x.short}</span></li>)}
            </ul>
          );
        })()}
      </section>
      ) : (
        <form id="sym-form" className="card stack" data-cat="journal" onSubmit={save}>
          <div className="sym-day">
            <div className="field"><label htmlFor="sd">Dzień</label>
              <input id="sd" className="input" type="date" max={todayIso()} value={day} onChange={(e) => setDay(e.target.value)} /></div>
            <div className="seg" role="group" aria-label="Szybki wybór dnia">
              <button type="button" className={day === yesterdayIso() ? 'on' : ''} aria-pressed={day === yesterdayIso()} onClick={() => setDay(yesterdayIso())}>Wczoraj</button>
              <button type="button" className={day === todayIso() ? 'on' : ''} aria-pressed={day === todayIso()} onClick={() => setDay(todayIso())}>Dziś</button>
            </div>
          </div>
          {existing && <p className="muted small sym-exists">Wpis z tego dnia już istnieje, zapis go nadpisze.</p>}
          {all.map(({ key: k, label, help, custom }) => {
            const empty = f[k] === '';
            return (
              <div key={k} className={`sym-slider${empty ? ' unset' : ''}`}>
                <div className="sym-head">
                  <label htmlFor={`sy-${k}`} className={custom ? 'dn' : undefined}>{label}</label>
                  <span className={`sym-val${empty ? ' unset' : ''}`} aria-hidden="true">{empty ? 'Nie wpisano' : f[k]}</span>
                  {!empty && <button type="button" className="btn text small" onClick={() => setF({ ...f, [k]: '' })} aria-label={`Wyczyść: ${label}`}>Wyczyść</button>}
                </div>
                <small id={`sy-${k}-help`}>{help}</small>
                <input id={`sy-${k}`} type="range" min="0" max="10" step="1" value={empty ? 5 : f[k]} aria-describedby={`sy-${k}-help`}
                  aria-valuetext={empty ? 'nie wpisano, przesuń, aby ustawić' : `${f[k]} z 10`}
                  onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
                <div className="sym-scale" aria-hidden="true"><span>0</span><span>10</span></div>
              </div>
            );
          })}
          <div className="field"><label htmlFor="sy-note">Notatka (opcjonalnie)</label>
            <input id="sy-note" className="input" maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            {existing?.noteLocked && !f.note && <small>Zapisana notatka jest zaszyfrowana i chwilowo nieczytelna (brak klucza na serwerze). Zostanie zachowana; wpisany tu nowy tekst ją zastąpi.</small>}</div>
              <div className="sym-actions"><button className="btn" aria-busy={saving || undefined} disabled={saving}>Zapisz wpis</button>{existing && <button type="button" className="btn danger" onClick={remove}>Usuń wpis</button>}</div>
        </form>
      )}
      <CustomManager defs={defs} onChange={async (text) => { try { await reload(); setMsg(text ? { text } : null); } catch (e) { setMsg({ text: e.message, error: true }); } }} />
    </div>
  );
}
