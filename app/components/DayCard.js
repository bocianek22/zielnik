'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { api } from '@/lib/api';
import { SYMPTOMS } from '@/lib/symptoms';
import { METHODS, PERIODS } from '@/lib/usage-meta';
import { severityLabel } from '@/lib/adverse-meta';
import { longDay, num, weekday } from './charts/fmt';
import useFocusTrap from './useFocusTrap';
import useSheetDrag from './useSheetDrag';
import Icon from './Icon';

// „Karta dnia” (0.60.0): arkusz z wszystkim, co zapisano danego dnia (GET /api/day). Tylko odczyt i skróty do poprawek;
// bez ocen dnia i porównań. Zmiana dnia = nowy klucz komponentu (Calendar), więc stan startuje od zera. Nazwy odmian, własne objawy i notatka jako .dn (tryb dyskretny).
export default function DayCard({ day, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const ref = useRef(null);
  useFocusTrap(ref, true, onClose);
  useSheetDrag(ref, true, onClose);
  useEffect(() => {
    let live = true;
    api(`/api/day?d=${day}`).then((d) => { if (live) setData(d); }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [day]);

  const sym = data?.symptoms;
  const vals = sym ? [...SYMPTOMS.filter((s) => sym[s.key] != null).map((s) => ({ key: s.key, label: s.short, value: sym[s.key] })),
    ...sym.custom.map((c) => ({ key: `c${c.id}`, label: c.name, value: c.value, custom: true }))] : [];
  const empty = data && !data.usage.length && !data.purchases.length && !sym && !data.noUse && !data.factors?.length && !data.visits?.length && !data.adverse?.length;
  const title = `${weekday(day)} ${longDay(day)}`;

  return createPortal(
    <>
      <div className="rs-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="row-sheet day-card" role="dialog" aria-modal="true" aria-labelledby="dc-h" ref={ref}>
        <div className="dc-head">
          <h2 id="dc-h" className="rs-title">{title}</h2>
          <button type="button" className="btn text small" onClick={onClose}>Zamknij</button>
        </div>
        {err && <p className="alert error" role="alert">{err}</p>}
        {!data && !err && <p className="muted small" role="status">Wczytuję…</p>}
        {empty && <p className="muted">Brak wpisów z tego dnia.</p>}
        {data?.noUse && <p className="dc-nouse"><Icon name="check" size={18} />Oznaczony jako dzień bez zużycia.</p>}
        {data?.usage.length > 0 && (
          <section aria-labelledby="dc-u">
            <h3 id="dc-u" className="section-label">Zużycie</h3>
            <ul className="dc-list">
              {data.usage.map((u, i) => (
                <li key={i}><span className="dn">{u.name}</span>
                  <span className="dc-meta"><b className="qty">{num(u.amount)}<span className="unit">{u.unit}</span></b>
                    {[PERIODS[u.period], METHODS[u.method], u.time].filter(Boolean).join(' · ')}</span></li>
              ))}
            </ul>
          </section>
        )}
        {data?.purchases.length > 0 && (
          <section aria-labelledby="dc-p">
            <h3 id="dc-p" className="section-label">Wykupione</h3>
            <ul className="dc-list">
              {data.purchases.map((p, i) => (
                <li key={i}><span className="dn">{p.name}</span>
                  <span className="dc-meta"><b className="qty">{num(p.amount)}<span className="unit">{p.unit}</span></b>{p.time}</span></li>
              ))}
            </ul>
          </section>
        )}
        {sym && (
          <section aria-labelledby="dc-s">
            <h3 id="dc-s" className="section-label">Objawy (0–10)</h3>
            {vals.length > 0 && (
              <ul className="sym-tiles">
                {vals.map((v) => <li key={v.key}><b>{v.value}</b><span className={v.custom ? 'dn' : undefined}>{v.label}</span></li>)}
              </ul>
            )}
            {sym.note && <p className="dc-note dn">{sym.note}</p>}
            {sym.noteLocked && <p className="muted small">Notatka jest zaszyfrowana i chwilowo nieczytelna.</p>}
          </section>
        )}
        {data?.visits?.length > 0 && (
          <section aria-labelledby="dc-v">
            <h3 id="dc-v" className="section-label">Wizyta</h3>
            {data.visits.map((v, i) => v.note ? <p key={i} className="dc-note dn">{v.note}</p> : <p key={i} className="muted small">{v.noteLocked ? 'Notatka jest zaszyfrowana i chwilowo nieczytelna.' : 'Bez notatki.'}</p>)}
          </section>
        )}
        {data?.adverse?.length > 0 && (
          <section aria-labelledby="dc-a">
            <h3 id="dc-a" className="section-label">Zdarzenie niepożądane</h3>
            {data.adverse.map((v, i) => (
              <p key={i} className="dc-note">
                <strong>Nasilenie: {severityLabel(v.severity)}</strong>
                {v.note ? <><br /><span className="dn">{v.note}</span></> : v.noteLocked ? <><br /><span className="muted small">Opis jest zaszyfrowany i chwilowo nieczytelny.</span></> : null}
              </p>
            ))}
          </section>
        )}
        {data?.factors?.length > 0 && (
          <section aria-labelledby="dc-f">
            <h3 id="dc-f" className="section-label">Czynniki dnia</h3>
            <p className="chips">{data.factors.map((n) => <span key={n} className="chip tag dn">{n}</span>)}</p>
          </section>
        )}
        {data && (
          <div className="list dc-actions">
            <Link className="list-row" href={`/dziennik?dzien=${day}`} onClick={onClose}>
              <span className="ic-dot sm" data-cat="journal"><Icon name="pulse" size={18} /></span>
              <span className="lr-main">{sym ? 'Zmień wpis objawów' : 'Dodaj wpis objawów za ten dzień'}</span>
              <Icon name="chevronRight" size={18} className="lr-chev" />
            </Link>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
