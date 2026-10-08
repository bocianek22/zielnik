'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { FORMS } from '@/lib/forms';
import { unitOf } from '@/lib/units';
import { strainItems, catalogItems } from '@/lib/searchItems';
import { parseNum, decimalProps } from './num';
import SearchSuggest from './SearchSuggest';
import Icon from './Icon';
import RxForm from '../recepty/RxForm';
import PushSettings from '../profil/PushSettings';
import ReminderSettings from '../profil/ReminderSettings';
import DiscreetSettings from '../profil/DiscreetSettings';

// Kreator pierwszego uruchomienia (POM-19 / UX-6): nowe konto bez odmian i recept widzi go zamiast pustego ekranu głównego.
// Trzy kroki, każdy do pominięcia, i podsumowanie. Zapisy idą istniejącymi trasami (odmiana, wpis, recepta, przypomnienia);
// „zamknięte” zapamiętuje serwer (POST /api/onboarding), więc kreator nie wraca na innym urządzeniu.
// To zwykła sekcja strony, nie arkusz: bez pułapki fokusu, a po zmianie kroku fokus trafia na jego nagłówek.
const STEPS = ['Odmiana', 'Recepta', 'Przypomnienia'];
const pl = (n) => Number(Number(n).toFixed(2)).toLocaleString('pl-PL');

function StrainStep({ onSaved, onSkip }) {
  const [catalog, setCatalog] = useState([]);
  const [index, setIndex] = useState([]);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(null); // { strainId?, name, producer, form, catalog? }
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ producer: '', name: '', form: 'susz' });
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const amountRef = useRef(null);
  const nameRef = useRef(null);

  useEffect(() => {
    api('/api/catalog').then((r) => setCatalog(r.items || [])).catch(() => {});
    api('/api/strains?view=index').then((r) => setIndex(r.strains || [])).catch(() => {});
  }, []);
  useEffect(() => { if (pick) amountRef.current?.focus(); }, [pick]);
  useEffect(() => { if (manual) nameRef.current?.focus(); }, [manual]);

  const groups = useMemo(() => {
    const have = new Set(index.map((s) => `${s.producer}|${s.name}`.toLowerCase()));
    return [
      { key: 'strains', title: 'W bazie odmian', items: strainItems(index) },
      { key: 'catalog', title: 'Z katalogu', items: catalogItems(catalog.filter((c) => !have.has(`${c.producer}|${c.name}`.toLowerCase()))) },
    ];
  }, [index, catalog]);

  function choose(item) {
    if (item.type === 'strain') {
      const s = index.find((x) => x.id === item.id);
      if (s) setPick({ strainId: s.id, name: s.name, producer: s.producer, form: s.form || 'susz' });
    } else {
      const c = catalog.find((x) => x.id === item.id);
      if (c) setPick({ catalog: c, name: c.name, producer: c.producer, form: c.form || 'susz' });
    }
    setErr('');
  }
  const startManual = () => { setM({ producer: '', name: q.trim().slice(0, 60), form: 'susz' }); setManual(true); setErr(''); };
  const reset = () => { setPick(null); setManual(false); setAmount(''); setErr(''); };

  const target = manual ? { name: m.name.trim(), producer: m.producer.trim(), form: m.form } : pick;
  const unit = target ? unitOf(target.form) : 'g';

  async function save(e) {
    e.preventDefault();
    if (busy || !target) return;
    if (!target.name) { setErr('Podaj nazwę odmiany.'); nameRef.current?.focus(); return; }
    if (!target.producer) { setErr('Podaj producenta.'); return; }
    const n = parseNum(amount);
    if (Number.isNaN(n) || (n != null && n > 100000)) { setErr('Wpisz ilość jako liczbę, np. 3,5.'); amountRef.current?.focus(); return; }
    setBusy(true); setErr('');
    try {
      let id = pick?.strainId;
      if (!id) {
        // jak „Dodaj” w katalogu: ten sam zapis odmiany (typ „nieokreślony” uzupełnisz w szczegółach)
        const c = pick?.catalog;
        id = (await api('/api/strains', 'POST', {
          producer: target.producer, name: target.name, type: 'nieokreślony', kind: c?.kind || '', form: target.form, thc: c?.thc ?? '', cbd: c?.cbd ?? '',
          finalRating: '', taste: '', terpenes: [], description: '', price: '', batch: '', expires: '',
        })).id;
        setManual(false);
        setPick({ ...(pick || target), strainId: id }); // ponowna próba po błędzie nie dubluje odmiany
      }
      await api(`/api/strains/${id}/entry`, 'PUT', { current: n ?? 0 });
      onSaved({ name: target.name, amount: n ?? 0, unit });
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <form className="stack" onSubmit={save} noValidate>
      {!target && (
        <>
          <div className="field">
            <label htmlFor="onb-q">Odmiana albo producent</label>
            <SearchSuggest value={q} onChange={setQ} groups={groups} onPick={choose} onEnter={() => document.activeElement?.blur?.()}
              inputProps={{ id: 'onb-q', placeholder: 'Zacznij pisać nazwę…', maxLength: 60 }} />
            <small className="muted">Podpowiadam z bazy odmian i katalogu. Wybierz pozycję z listy.</small>
          </div>
          {q.trim().length > 1 && <div><button type="button" className="btn ghost" onClick={startManual}><Icon name="plus" size={18} />Nie ma na liście? Dodaj „<span className="dn">{q.trim()}</span>” ręcznie</button></div>}
        </>
      )}
      {target && (
        <>
          {pick && !manual ? (
            <p className="onb-picked"><span><b className="dn">{pick.name}</b><span className="muted"> · <span className="dn">{pick.producer}</span></span></span>
              <button type="button" className="btn text small" onClick={reset} aria-label="Wybierz inną odmianę">Zmień</button></p>
          ) : (
            <div className="stack">
              <div className="field"><label htmlFor="onb-name">Odmiana</label>
                <input id="onb-name" ref={nameRef} className="input" maxLength={60} value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} /></div>
              <div className="field"><label htmlFor="onb-producer">Producent</label>
                <input id="onb-producer" className="input" maxLength={40} list="onb-producers" value={m.producer} onChange={(e) => setM({ ...m, producer: e.target.value })} />
                <datalist id="onb-producers">{[...new Set(catalog.map((c) => c.producer))].map((p) => <option key={p} value={p} />)}</datalist></div>
              <div className="field"><label htmlFor="onb-form">Postać</label>
                <select id="onb-form" className="input" value={m.form} onChange={(e) => setM({ ...m, form: e.target.value })}>
                  {FORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></div>
              <div><button type="button" className="btn text small" onClick={reset}>Wróć do wyszukiwania</button></div>
            </div>
          )}
          <div className="field">
            <label htmlFor="onb-amount">Ile masz teraz ({unit})</label>
            <input id="onb-amount" ref={amountRef} className="input narrow-input" {...decimalProps} placeholder={unit === 'ml' ? 'np. 30' : 'np. 3,5'}
              value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={err.startsWith('Wpisz') ? true : undefined} />
            <small className="muted">Możesz zostawić puste i uzupełnić później.</small>
          </div>
        </>
      )}
      {err && <div className="alert error" role="alert">{err}</div>}
      <div className="onb-actions">
        {target && <button className="btn" disabled={busy}>{busy ? 'Zapisuję…' : 'Zapisz i dalej'}</button>}
        <button type="button" className="btn ghost" onClick={onSkip}>Pomiń ten krok</button>
      </div>
    </form>
  );
}

function RxStep({ onSaved, onSkip }) {
  return (
    <div className="stack">
      <RxForm onAdded={(list) => onSaved(list[0])} />
      <div className="onb-actions"><button type="button" className="btn ghost" onClick={onSkip}>Pomiń ten krok</button></div>
    </div>
  );
}

function RemindersStep({ onNext }) {
  return (
    <div className="stack">
      <PushSettings />
      <ReminderSettings />
      <DiscreetSettings />
      <div className="onb-actions"><button type="button" className="btn" onClick={onNext}>Dalej</button></div>
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(0); // 0..2 kroki, 3 podsumowanie
  const [done, setDone] = useState({ strain: null, rx: null });
  const [saved, setSaved] = useState(null); // 'strain' | 'rx': krok zapisany, czeka na „Dalej”
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const head = useRef(null);
  const next = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    head.current?.focus();
  }, [step]);
  useEffect(() => { if (saved) next.current?.focus(); }, [saved]);

  const go = (n) => { setSaved(null); setStep(n); };
  async function close() {
    if (busy) return;
    setBusy(true); setErr('');
    // pełne przeładowanie zamiast router.refresh(): odświeżenie RSC bywało gubione i kreator zostawał na ekranie
    try { await api('/api/onboarding', 'POST'); window.location.replace('/'); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  const titles = [
    'Jaką odmianę masz teraz?',
    'Masz receptę?',
    'Przypomnienia i prywatność',
    'Gotowe: Twój panel „Dziś”',
  ];
  const lead = [
    'Wybierz odmianę i wpisz, ile jej masz. Z tego policzę zapas i prognozę, na ile dni starczy.',
    'Z receptą zobaczysz, ile zostało do wykupienia i do kiedy jest ważna.',
    'Wszystko jest wyłączone, dopóki tego nie włączysz. Ustawienia zmienisz później w profilu.',
    '',
  ];

  return (
    <div className="stack onb">
      <header className="onb-head">
        <h1>Pierwsze kroki</h1>
        <p className="muted">Trzy krótkie kroki. Każdy możesz pominąć i uzupełnić później.</p>
        {step < 3 && <button type="button" className="btn text small" onClick={close} disabled={busy}>Zamknij kreator</button>}
      </header>
      {err && <div className="alert error" role="alert">{err}</div>}
      <ol className="onb-steps" aria-label="Postęp kreatora">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={step === i ? 'step' : undefined} className={step === i ? 'on' : step > i ? 'past' : ''}>
            <span className="onb-n" aria-hidden="true">{step > i ? <Icon name="check" size={16} /> : i + 1}</span>
            <span>{s}{step > i && <span className="sr-only"> (zakończony)</span>}</span>
          </li>
        ))}
      </ol>
      <section className="card stack onb-card" aria-labelledby="onb-h">
        <p className="onb-count">{step < 3 ? `Krok ${step + 1} z 3` : 'Koniec'}</p>
        <h2 id="onb-h" ref={head} tabIndex={-1}>{titles[step]}</h2>
        {lead[step] && <p className="muted">{lead[step]}</p>}

        {step === 0 && (saved === 'strain' ? (
          <div className="stack">
            <p className="alert ok" role="status">Dodano: <b className="dn">{done.strain.name}</b>{done.strain.amount > 0 && `, masz ${pl(done.strain.amount)} ${done.strain.unit}`}.</p>
            <div className="onb-actions"><button type="button" ref={next} className="btn" onClick={() => go(1)}>Dalej</button></div>
          </div>
        ) : <StrainStep onSaved={(s) => { setDone((d) => ({ ...d, strain: s })); setSaved('strain'); }} onSkip={() => go(1)} />)}

        {step === 1 && (saved === 'rx' ? (
          <div className="stack">
            <p className="alert ok" role="status">Dodano receptę na {pl(done.rx.grams)} {done.rx.unit === 'ml' ? 'ml' : 'g'}.</p>
            <div className="onb-actions"><button type="button" ref={next} className="btn" onClick={() => go(2)}>Dalej</button></div>
          </div>
        ) : <RxStep onSaved={(r) => { setDone((d) => ({ ...d, rx: r })); setSaved('rx'); }} onSkip={() => go(2)} />)}

        {step === 2 && <RemindersStep onNext={() => go(3)} />}

        {step === 3 && (
          <div className="stack">
            <ul className="onb-sum">
              <li>{done.strain ? <>Odmiana: <b className="dn">{done.strain.name}</b>{done.strain.amount > 0 && `, ${pl(done.strain.amount)} ${done.strain.unit}`}</> : 'Odmiana: pominięta, dodasz ją na ekranie głównym.'}</li>
              <li>{done.rx ? `Recepta: ${pl(done.rx.grams)} ${done.rx.unit === 'ml' ? 'ml' : 'g'}` : 'Recepta: pominięta, dodasz ją w zakładce „Recepty”.'}</li>
            </ul>
            <p className="muted">W panelu „Dziś” zobaczysz zapas, prognozę i szybkie „Zużyłem”. Objawy wpiszesz tam jednym dotknięciem, a z zapisów powstanie raport dla lekarza.</p>
            <div className="onb-actions"><button type="button" className="btn" onClick={close} disabled={busy}>{busy ? 'Otwieram…' : 'Przejdź do panelu „Dziś”'}</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
