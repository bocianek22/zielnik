'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuickSave, SaveNote } from './useQuickSave';
import { METHODS, PERIODS, defaultMethod } from '@/lib/usage-meta';
import { unitOf, unitGen, quickValues, consumePlaceholder, buyPlaceholder } from '@/lib/units';

// tytuł, szybkie wartości i przykład zależą od postaci (susz w g, olej i pen w ml)
const modes = (form) => {
  const u = unitGen(unitOf(form)), qv = quickValues(form);
  return {
    use: { label: 'Zużyłem', title: `Ile ${u} zużyłeś?`, quick: qv.use, ph: consumePlaceholder(form), save: 'Zapisz zużycie', path: 'usage' },
    buy: { label: 'Wykupiłem', title: `Ile ${u} wykupiłeś?`, quick: qv.buy, ph: buyPlaceholder(form), save: 'Zapisz wykup', path: 'purchase' },
  };
};
const pl = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',');
// przecinek dziesiętny z klawiatury telefonu -> kropka; zwraca liczbę albo null
export const parseGrams = (s) => {
  const n = Number(String(s).trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 100000 ? n : null;
};

// Szybkie akcje na wierzchu karty: „Zużyłem” i „Wykupiłem” z małym panelem na ilość w jednostce odmiany (bez rozwijania karty).
// idPrefix: inny przedrostek identyfikatorów, gdy ta sama odmiana ma akcje także w panelu „Dziś” (unikalne id w DOM);
// buy={false}: tylko „Zużyłem”.
export default function QuickActions({ strainId, name, form = 'susz', current, remaining, onSaved, idPrefix = 'q', buy = true }) {
  const unit = unitOf(form);
  const MODES = modes(form);
  const [mode, setMode] = useState(null); // null | 'use' | 'buy'
  const [val, setVal] = useState('');
  const [method, setMethod] = useState(''); // POM-03: opcjonalne, zwinięte; '' = nie podano (w podsumowaniu podpowiedź z postaci)
  const [period, setPeriod] = useState(''); // '' = z godziny zapisu
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = useRef(null);
  const trigger = useRef({});
  const mounted = useRef(true);
  const qs = useQuickSave(strainId);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (mode) input.current?.focus(); }, [mode]);

  function open(m) {
    if (mode === m) return close();
    setMode(m); setVal(''); setErr(''); setMethod(''); setPeriod(''); qs.clear(); qs.renew(); // nowe otwarcie panelu = nowy zapis
  }
  function close() {
    const m = mode;
    setMode(null); setErr('');
    if (m) trigger.current[m]?.focus();
  }

  async function submit(e) {
    e?.preventDefault();
    if (busy) return;
    const g = parseGrams(val);
    if (g == null) { setErr('Podaj ilość większą od zera, np. 0,5.'); input.current?.focus(); return; }
    setBusy(true); setErr('');
    try {
      const kind = MODES[mode].path;
      // o ile od razu zmieni się stan i pula, gdy zapis trafi do kolejki offline (lista cofnie to przy usunięciu z kolejki)
      const cur = Number(current) || 0, rem = Number(remaining) || 0;
      const delta = mode === 'use' ? Math.min(g, Math.max(cur, 0)) : g;
      const poolDelta = mode === 'use' ? 0 : Math.min(g, Math.max(rem, 0));
      const r = await qs.save(kind, g, { name, unit, delta, poolDelta }, mode === 'use' ? { ...(method && { method }), ...(period && { period }) } : {});
      if (!mounted.current) return;
      if (r.queued) {
        const undoQ = { kind, queued: r.queued.id };
        if (mode === 'use') {
          onSaved({ current: cur - delta, used: g });
          qs.show(`Czeka na wysłanie: −${pl(g)} ${unit}, zostanie ${pl(cur - delta)} ${unit}. Wyślę, gdy wróci sieć.`, false, undoQ);
        } else {
          onSaved({ current: cur + g, remaining: rem - poolDelta, bought: g });
          qs.show(`Czeka na wysłanie: +${pl(g)} ${unit}, będzie ${pl(cur + g)} ${unit}. Wyślę, gdy wróci sieć.`, false, undoQ);
        }
        setMode(null); setVal('');
        return;
      }
      const undo = r.id ? { kind, id: r.id } : null;
      if (mode === 'use') {
        onSaved({ current: r.current, used: r.used });
        qs.show(r.stockShort
          ? `Zapisano: −${pl(r.used)} ${unit}. Zapisany stan był mniejszy niż zużycie, ustawiono 0 ${unit}.`
          : `Zapisano: −${pl(r.used)} ${unit}, zostało ${pl(r.current)} ${unit}`, !!r.stockShort, undo);
      } else {
        onSaved({ current: r.current, remaining: r.remaining, bought: r.bought ?? g });
        qs.show(`Zapisano: +${pl(r.bought ?? g)} ${unit}, masz ${pl(r.current)} ${unit}, do wykupienia ${pl(r.remaining)} ${unit}`, false, undo);
      }
      setMode(null); setVal('');
    } catch (e2) { if (mounted.current) setErr(e2.message); }
    finally { if (mounted.current) setBusy(false); }
  }

  // „Cofnij”: serwer usuwa wpis i oddaje stan (oraz pulę przy wykupie); used/bought ujemne cofają wykres i sumy
  async function undo() {
    const r = await qs.undo();
    if (r) onSaved(r);
  }

  const m = mode && MODES[mode];
  const showUse = Number(current) > 0;
  const id = `${idPrefix}${strainId}`;
  return (
    <div className="quick" onKeyDown={(e) => { if (e.key === 'Escape' && mode) { e.stopPropagation(); close(); } }}>
      <div className="quick-btns">
        {showUse && (
          <button type="button" ref={(el) => { trigger.current.use = el; }} className={`btn small quick-btn${mode === 'use' ? ' on' : ''}`}
            aria-expanded={mode === 'use'} aria-controls={id} aria-label={`Zużyłem: ${name}`} onClick={() => open('use')}>Zużyłem</button>
        )}
        {buy && (
          <button type="button" ref={(el) => { trigger.current.buy = el; }} className={`btn small quick-btn ghost${mode === 'buy' ? ' on' : ''}`}
            aria-expanded={mode === 'buy'} aria-controls={id} aria-label={`Wykupiłem: ${name}`} onClick={() => open('buy')}>Wykupiłem</button>
        )}
        <span className="quick-stock muted">Mam {pl(current)} {unit}{Number(remaining) > 0 && <>, do wykupienia {pl(remaining)} {unit}</>}</span>
      </div>
      {m && (
        <form id={id} className="quick-panel" role="group" aria-label={`${m.label}: ${name}`} onSubmit={submit}>
          <label htmlFor={`${id}-g`}>{m.title}</label>
          <div className="chips small quick-chips">
            {m.quick.map((v) => <button key={v} type="button" className="chip use-chip" disabled={busy} onClick={() => { setVal(pl(v)); setErr(''); input.current?.focus(); }}>{pl(v)} {unit}</button>)}
          </div>
          <div className="use-row">
            <input id={`${id}-g`} ref={input} className="input" type="text" inputMode="decimal" autoComplete="off" enterKeyHint="done"
              placeholder={m.ph} value={val} aria-invalid={!!err} aria-describedby={err ? `${id}-e` : undefined}
              onChange={(e) => { setVal(e.target.value); setErr(''); }} />
            <button type="submit" className="btn small" disabled={busy}>{busy ? 'Zapisuję…' : m.save}</button>
            <button type="button" className="btn small ghost" onClick={close}>Anuluj</button>
          </div>
          {mode === 'use' && (
            <details className="quick-more">
              <summary>Sposób i pora: {METHODS[method || defaultMethod(form)]}, {period ? PERIODS[period] : 'teraz'}</summary>
              <div className="quick-more-row">
                <label htmlFor={`${id}-m`}>Sposób</label>
                <select id={`${id}-m`} className="input" value={method || defaultMethod(form)} onChange={(e) => setMethod(e.target.value)}>
                  {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <label htmlFor={`${id}-p`}>Pora</label>
                <select id={`${id}-p`} className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <option value="">teraz (z godziny zapisu)</option>
                  {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </details>
          )}
          {err && <p id={`${id}-e`} className="field-err" role="alert">{err}</p>}
        </form>
      )}
      <SaveNote note={qs.note} undoing={qs.undoing} onUndo={undo} />
    </div>
  );
}
