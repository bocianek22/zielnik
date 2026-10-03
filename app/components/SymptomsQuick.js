'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { SYMPTOMS, QUICK_STEPS } from '@/lib/symptoms';
import Icon from './Icon';

// Szybki wpis objawów w panelu „Dziś” (POM-04): cztery wymiary, pięć stopni, zapis po każdym dotknięciu.
// PUT /api/symptoms nadpisuje cały wiersz dnia, więc zawsze wysyłamy wszystkie wymiary i dotychczasową notatkę.
// Żądania idą po kolei, a każde wysyła najnowszy stan: szybkie dotknięcia nie nadpiszą się w złej kolejności.

const pick = (r) => ({ pain: r?.pain ?? null, sleep: r?.sleep ?? null, anxiety: r?.anxiety ?? null, mood: r?.mood ?? null, note: r?.note ?? '' });
const count = (v) => SYMPTOMS.filter((s) => v[s.key] != null).length;

export default function SymptomsQuick({ day, initial }) {
  const [v, setV] = useState(() => pick(initial));
  const [open, setOpen] = useState(() => count(pick(initial)) < SYMPTOMS.length);
  const [status, setStatus] = useState(null); // { text, error }
  const latest = useRef(v);       // stan do wysłania
  const confirmed = useRef(v);    // ostatni stan potwierdzony przez serwer
  const queue = useRef(Promise.resolve());
  const seq = useRef(0);
  const focus = useRef(null);     // 'change' | 'first': dokąd przenieść fokus po zwinięciu/rozwinięciu
  const changeBtn = useRef(null);
  const firstBtn = useRef(null);

  useEffect(() => {
    if (focus.current === 'change') changeBtn.current?.focus();
    if (focus.current === 'first') firstBtn.current?.focus();
    focus.current = null;
  }, [open]);

  function choose(key, n) {
    const before = count(latest.current);
    const next = { ...latest.current, [key]: latest.current[key] === n ? null : n };
    latest.current = next;
    setV(next);
    setStatus({ text: 'Zapisywanie…' });
    const id = ++seq.current;
    const completes = before < SYMPTOMS.length && count(next) === SYMPTOMS.length;
    queue.current = queue.current.then(async () => {
      if (id !== seq.current) return; // nowsze dotknięcie wyśle pełny, aktualny stan
      try {
        const res = await api('/api/symptoms', 'PUT', { day, ...latest.current });
        const saved = pick(res.rows.find((r) => r.day === day) ?? latest.current);
        confirmed.current = saved;
        if (id !== seq.current) return;
        latest.current = saved;
        setV(saved);
        setStatus({ text: 'Zapisano.' });
        if (completes) { focus.current = 'change'; setOpen(false); }
      } catch (e) {
        if (id !== seq.current) return;
        latest.current = confirmed.current;
        setV(confirmed.current);
        setStatus({ text: `Nie zapisano: ${e.message}`, error: true });
      }
    });
  }

  const filled = count(v);
  const summary = SYMPTOMS.map((s) => `${s.short} ${v[s.key] ?? '–'}`).join(' · ');

  return (
    <section className="card tsym" id="objawy" aria-labelledby="tsym-h">
      <div className="today-card-head">
        <h2 id="tsym-h" className="today-h">Jak się dziś czujesz?</h2>
        <Link className="btn text small" href="/dziennik">Dziennik<Icon name="chevronRight" size={18} /></Link>
      </div>

      {!open ? (
        <div className="tsym-done">
          <p className="tsym-sum">
            <span className="tsym-ok">{filled === SYMPTOMS.length ? 'Zapisano dziś' : `Zapisano dziś ${filled} z ${SYMPTOMS.length}`}</span>
            <span className="tsym-vals">{summary}</span>
          </p>
          <button type="button" ref={changeBtn} className="btn text small" onClick={() => { focus.current = 'first'; setOpen(true); setStatus(null); }}>Zmień</button>
        </div>
      ) : (
        <div className="tsym-form">
          {filled === 0 && <p className="tsym-hint">Jedno dotknięcie zapisuje wpis z dziś. Pełna skala i notatka są w dzienniku.</p>}
          {SYMPTOMS.map((s, si) => {
            const cur = v[s.key];
            return (
              <div key={s.key} className="tsym-row" role="group" aria-labelledby={`tsym-${s.key}`}>
                <div className="tsym-head">
                  <span id={`tsym-${s.key}`} className="tsym-label">{s.label}</span>
                  <span className={`tsym-val${cur == null ? ' unset' : ''}`}>{cur == null ? 'nie wpisano' : <><b>{cur}</b> z 10</>}</span>
                </div>
                <div className="tsym-btns">
                  {QUICK_STEPS.map((n, ni) => {
                    const on = cur === n;
                    return (
                      <button key={n} type="button" ref={si === 0 && ni === 0 ? firstBtn : undefined} className={on ? 'on' : ''} aria-pressed={on}
                        aria-label={`${s.label}: ${n} z 10${on ? ' (dotknij ponownie, aby wyczyścić)' : ''}`} onClick={() => choose(s.key, n)}>{n}</button>
                    );
                  })}
                </div>
                <div className="tsym-scale" aria-hidden="true"><span>{s.low}</span><span>{s.high}</span></div>
              </div>
            );
          })}
          {filled > 0 && (
            <div className="tsym-foot"><button type="button" className="btn text small" onClick={() => { focus.current = 'change'; setOpen(false); }}>Gotowe</button></div>
          )}
        </div>
      )}
      <p className={`tsym-status${status?.error ? ' error' : !open ? ' sr-only' : ''}`} role="status">{status?.text}</p>
    </section>
  );
}
