'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuickSave, SaveNote } from './useQuickSave';

const MODES = {
  use: { label: 'Zużyłem', title: 'Ile gramów zużyłeś?', quick: [0.1, 0.25, 0.5, 1], save: 'Zapisz zużycie', path: 'usage' },
  buy: { label: 'Wykupiłem', title: 'Ile gramów wykupiłeś?', quick: [5, 10, 15], save: 'Zapisz wykup', path: 'purchase' },
};
const pl = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',');
// przecinek dziesiętny z klawiatury telefonu -> kropka; zwraca liczbę albo null
export const parseGrams = (s) => {
  const n = Number(String(s).trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 100000 ? n : null;
};

// Szybkie akcje na wierzchu karty: „Zużyłem” i „Wykupiłem” z małym panelem na gramy (bez rozwijania karty).
// idPrefix: inny przedrostek identyfikatorów, gdy ta sama odmiana ma akcje także w panelu „Dziś” (unikalne id w DOM);
// buy={false}: tylko „Zużyłem”.
export default function QuickActions({ strainId, name, current, remaining, onSaved, idPrefix = 'q', buy = true }) {
  const [mode, setMode] = useState(null); // null | 'use' | 'buy'
  const [val, setVal] = useState('');
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
    setMode(m); setVal(''); setErr(''); qs.clear();
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
      const r = await qs.save(kind, g);
      if (!mounted.current) return;
      const undo = r.id ? { kind, id: r.id } : null;
      if (mode === 'use') {
        onSaved({ current: r.current, used: r.used });
        qs.show(r.stockShort
          ? `Zapisano: −${pl(r.used)} g. Zapisany stan był mniejszy niż zużycie, ustawiono 0 g.`
          : `Zapisano: −${pl(r.used)} g, zostało ${pl(r.current)} g`, !!r.stockShort, undo);
      } else {
        onSaved({ current: r.current, remaining: r.remaining, bought: r.bought ?? g });
        qs.show(`Zapisano: +${pl(r.bought ?? g)} g, masz ${pl(r.current)} g, do wykupienia ${pl(r.remaining)} g`, false, undo);
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
        <span className="quick-stock muted">Mam {pl(current)} g{Number(remaining) > 0 && <>, do wykupienia {pl(remaining)} g</>}</span>
      </div>
      {m && (
        <form id={id} className="quick-panel" role="group" aria-label={`${m.label}: ${name}`} onSubmit={submit}>
          <label htmlFor={`${id}-g`}>{m.title}</label>
          <div className="chips small quick-chips">
            {m.quick.map((v) => <button key={v} type="button" className="chip use-chip" disabled={busy} onClick={() => { setVal(pl(v)); setErr(''); input.current?.focus(); }}>{pl(v)} g</button>)}
          </div>
          <div className="use-row">
            <input id={`${id}-g`} ref={input} className="input" type="text" inputMode="decimal" autoComplete="off" enterKeyHint="done"
              placeholder="np. 0,5" value={val} aria-invalid={!!err} aria-describedby={err ? `${id}-e` : undefined}
              onChange={(e) => { setVal(e.target.value); setErr(''); }} />
            <button type="submit" className="btn small" disabled={busy}>{busy ? 'Zapisuję…' : m.save}</button>
            <button type="button" className="btn small ghost" onClick={close}>Anuluj</button>
          </div>
          {err && <p id={`${id}-e`} className="field-err" role="alert">{err}</p>}
        </form>
      )}
      <SaveNote note={qs.note} undoing={qs.undoing} onUndo={undo} />
    </div>
  );
}
