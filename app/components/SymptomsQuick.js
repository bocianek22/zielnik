'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { saveOrQueue, hasQueued } from '@/lib/offline-client';
import useQueueEvents from './useQueueEvents';
import { SYMPTOMS, QUICK_STEPS, customMeta } from '@/lib/symptoms';
import Icon from './Icon';
import Toast from './Toast';

// Szybki wpis objawów w panelu „Dziś” (POM-04): cztery wymiary, pięć stopni, zapis po każdym dotknięciu.
// PUT /api/symptoms nadpisuje cały wiersz dnia, więc zawsze wysyłamy wszystkie wymiary i dotychczasową notatkę.
// Żądania idą po kolei, a każde wysyła najnowszy stan: szybkie dotknięcia nie nadpiszą się w złej kolejności.
// Bez sieci wpis czeka w kolejce offline (POM-14; nowszy wpis dnia zastępuje czekający) i wysyła się po jej powrocie.
const QUEUED = 'Czeka na wysłanie. Wyślę, gdy wróci sieć.';

// Własne objawy (POM-07) są w stanie jako `c<id>`, a do serwera idą w osobnym polu `custom` ({ id: wartość | null }).
// Wartości bierzemy z wiersza dnia (`custom: { id: wartość }`), z odpowiedzi serwera (`customValues`) albo z treści zapisu.
const pick = (r, defs = []) => ({
  pain: r?.pain ?? null, sleep: r?.sleep ?? null, anxiety: r?.anxiety ?? null, mood: r?.mood ?? null, note: r?.note ?? '',
  ...Object.fromEntries(defs.map((d) => [`c${d.id}`, r?.custom?.[d.id] ?? null])),
});
const fromServer = (res, day, defs, fallback) => {
  const row = res.rows.find((r) => r.day === day);
  const custom = Object.fromEntries((res.customValues ?? []).filter((x) => x.day === day).map((x) => [x.id, x.value]));
  return row || Object.keys(custom).length ? pick({ ...row, custom }, defs) : fallback;
};
const toBody = (day, v, defs) => ({
  day, pain: v.pain, sleep: v.sleep, anxiety: v.anxiety, mood: v.mood, note: v.note,
  ...(defs.length ? { custom: Object.fromEntries(defs.map((d) => [d.id, v[`c${d.id}`]])) } : {}),
});

// onChange(v): panel „Dziś” pokazuje dzisiejszy nastrój i zadanie „Wpisz objawy” na żywo, bez przeładowania
export default function SymptomsQuick({ day, initial, onChange }) {
  const defs = useMemo(() => initial?.defs ?? [], [initial]);
  const items = useMemo(() => [...SYMPTOMS, ...defs.map(customMeta)], [defs]);
  const count = (v) => items.filter((s) => v[s.key] != null).length;
  const [v, setV] = useState(() => pick(initial, defs));
  // zwinięte po komplecie wbudowanych: niewypełnione własne objawy nie rozwijają panelu przy każdym wejściu
  const [open, setOpen] = useState(() => SYMPTOMS.some((s) => pick(initial, defs)[s.key] == null));
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
    const completes = before < items.length && count(next) === items.length;
    queue.current = queue.current.then(async () => {
      if (id !== seq.current) return; // nowsze dotknięcie wyśle pełny, aktualny stan
      try {
        const out = await saveOrQueue({ kind: 'symptoms', url: '/api/symptoms', method: 'PUT', body: toBody(day, latest.current, defs), meta: { day } });
        if (out.queued) {
          if (id !== seq.current) return;
          setStatus({ text: QUEUED, queued: true });
          if (completes) { focus.current = 'change'; setOpen(false); }
          return;
        }
        const res = out.data;
        const saved = fromServer(res, day, defs, latest.current);
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

  // wynik kolejki offline dla wpisu z tego dnia
  useQueueEvents((d) => {
    if (d.item?.kind !== 'symptoms' || d.item.meta?.day !== day) return;
    const newer = hasQueued((i) => i.kind === 'symptoms' && i.meta?.day === day);
    if (d.type === 'sent') {
      confirmed.current = d.data?.rows ? fromServer(d.data, day, defs, pick(d.item.body, defs)) : pick({ ...d.item.body, custom: d.item.body?.custom }, defs);
      if (!newer) setStatus({ text: 'Wysłano wpis objawów.' });
    } else if ((d.type === 'removed' || d.type === 'rejected') && !newer) {
      latest.current = confirmed.current;
      setV(confirmed.current);
      setStatus(d.type === 'rejected' ? { text: `Nie zapisano: ${d.message}`, error: true } : { text: 'Usunięto wpis objawów z kolejki.' });
    }
  });

  const filled = count(v);
  useEffect(() => { onChange?.(v); }, [v, onChange]);

  return (
    <section className="card tint tsym" data-cat="journal" id="objawy" aria-labelledby="tsym-h">
      <div className="sec-head">
        <span className="ic-dot solid"><Icon name="pulse" size={22} /></span>
        <h2 id="tsym-h">Jak się dziś czujesz?</h2>
        <Link className="btn text small" href="/dziennik">Dziennik<Icon name="chevronRight" size={18} /></Link>
      </div>

      {!open ? (
        <div className="tsym-done">
          <p className="tsym-sum">
            <span className="tsym-ok">{status?.queued ? (filled === items.length ? 'Czeka na wysłanie' : `Czeka na wysłanie: ${filled} z ${items.length}`)
              : filled === items.length ? 'Zapisano dziś' : `Zapisano dziś ${filled} z ${items.length}`}</span>
            <span className="tsym-vals">{items.map((s, i) => <span key={s.key}>{i > 0 && ' · '}<span className={s.custom ? 'dn' : undefined}>{s.short}</span> {v[s.key] ?? '–'}</span>)}</span>
          </p>
          <button type="button" ref={changeBtn} className="btn text small" onClick={() => { focus.current = 'first'; setOpen(true); setStatus(null); }}>Zmień</button>
        </div>
      ) : (
        <div className="tsym-form">
          {filled === 0 && <p className="tsym-hint">Jedno dotknięcie zapisuje wpis z dziś. Pełna skala i notatka są w dzienniku.</p>}
          {items.map((s, si) => {
            const cur = v[s.key];
            return (
              <div key={s.key} className="tsym-row" role="group" aria-labelledby={`tsym-${s.key}`}>
                <div className="tsym-head">
                  <span id={`tsym-${s.key}`} className={`tsym-label${s.custom ? ' dn' : ''}`}>{s.label}</span>
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
      <Toast text={status?.text === 'Zapisywanie…' ? '' : status?.text} tone={status?.error ? 'warn' : status?.queued ? 'queued' : 'ok'}
        onClose={() => setStatus(null)} duration={status?.error || status?.queued ? 0 : undefined} />
    </section>
  );
}
