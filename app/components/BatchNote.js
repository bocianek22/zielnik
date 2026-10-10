'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDay } from '@/lib/date';
import { BATCH_EFFECTS, BATCH_NO_MAX, BATCH_NOTE_MAX, hasBatch } from '@/lib/batch-meta';
import SecHead from './SecHead';

const nf = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2 });

// Podsumowanie partii przy zakupie: numer, ważność, ocena („słabiej / jak zwykle / mocniej”) i notatka. Dane prywatne.
export function BatchSummary({ r }) {
  if (!hasBatch(r)) return null;
  return (
    <span className="batch-sum">
      {r.batchNo && <span className="batch-no">Partia <b className="dn">{r.batchNo}</b></span>}
      {r.batchExpires && <span className="batch-exp">ważna do {formatDay(r.batchExpires)}</span>}
      {r.batchEffect && BATCH_EFFECTS[r.batchEffect] && <span className="pill batch-eff" data-effect={r.batchEffect}>działała: {BATCH_EFFECTS[r.batchEffect]}</span>}
      {r.batchNote && <span className="batch-note">{r.batchNote}</span>}
      {r.batchNoteLocked && <span className="batch-note muted">Notatka zaszyfrowana, brak klucza.</span>}
    </span>
  );
}

// Formularz notatki o partii jednego zakupu (PUT /api/history/purchases/:id/batch). Pole notatki zostaje nietknięte,
// gdy jest zaszyfrowane i nieczytelne (serwer dostaje wtedy brak batchNote).
export function BatchForm({ purchase, onSaved, onCancel, idPrefix = 'batch' }) {
  const [f, setF] = useState({
    no: purchase.batchNo || '', exp: purchase.batchExpires || '', effect: purchase.batchEffect || '', note: purchase.batchNote || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const id = `${idPrefix}-${purchase.id}`;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const body = { batchNo: f.no, batchExpires: f.exp || null, batchEffect: f.effect || null };
      if (!(purchase.batchNoteLocked && !f.note)) body.batchNote = f.note;
      const r = await api(`/api/history/purchases/${purchase.id}/batch`, 'PUT', body);
      onSaved?.(r.batch);
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }
  return (
    <form className="batch-form stack" onSubmit={save} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel?.(); } }}>
      <div className="field">
        <label htmlFor={`${id}-no`}>Numer partii lub serii (opcjonalnie)</label>
        <input id={`${id}-no`} className="input" maxLength={BATCH_NO_MAX} value={f.no} onChange={set('no')} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor={`${id}-exp`}>Data ważności (opcjonalnie)</label>
        <input id={`${id}-exp`} className="input" type="date" min="2000-01-01" max="2100-12-31" value={f.exp} onChange={set('exp')} />
      </div>
      <div className="field">
        <span id={`${id}-eff`} className="label">Jak działała w porównaniu do zwykle?</span>
        <div className="seg" role="group" aria-labelledby={`${id}-eff`}>
          {Object.entries(BATCH_EFFECTS).map(([k, label]) => (
            <button key={k} type="button" className={f.effect === k ? 'on' : ''} aria-pressed={f.effect === k} onClick={() => setF((p) => ({ ...p, effect: p.effect === k ? '' : k }))}>{label}</button>
          ))}
        </div>
        <small className="muted">Twoja własna ocena, bez porad. Kliknij jeszcze raz, żeby wyczyścić.</small>
      </div>
      <div className="field">
        <label htmlFor={`${id}-note`}>Notatka o partii (opcjonalnie)</label>
        <textarea id={`${id}-note`} className="input" rows={3} maxLength={BATCH_NOTE_MAX} value={f.note} onChange={set('note')}
          placeholder={purchase.batchNoteLocked ? 'Zapisana notatka jest zaszyfrowana, zostanie bez zmian' : ''} />
      </div>
      <p className="muted small">Widzisz to tylko Ty. Notatka jest szyfrowana jak inne notatki, a w raporcie dla lekarza pojawia się tylko po zaznaczeniu „Dołącz moje spostrzeżenia”.</p>
      <div className="hist-edit-btns">
        <button type="submit" className="btn small" disabled={busy}>{busy ? 'Zapisuję…' : 'Zapisz partię'}</button>
        <button type="button" className="btn small ghost" onClick={onCancel}>Anuluj</button>
      </div>
      {err && <p className="field-err" role="alert">{err}</p>}
    </form>
  );
}

// Karta odmiany: zakupy tej odmiany z notatkami o partiach (ostatnie 20), edycja w miejscu.
export default function StrainBatches({ batches: serverBatches, unit }) {
  const router = useRouter();
  const [open, setOpen] = useState(null); // id edytowanego zakupu
  const [msg, setMsg] = useState('');
  const [local, setLocal] = useState({ base: null, map: {} }); // zapis widoczny od razu, do odświeżenia z serwera
  const batches = local.base === serverBatches ? serverBatches.map((b) => (local.map[b.id] ? { ...b, ...local.map[b.id] } : b)) : serverBatches;
  if (!batches.length) return null;
  return (
    <section className="card strain-batches" data-cat="stock" aria-labelledby="batches-h">
      <SecHead cat="stock" icon="cart" id="batches-h">Partie</SecHead>
      <p className="muted small">Zakupy tej odmiany. Dopisz, jak działała dana partia w porównaniu do zwykle. Widzisz to tylko Ty.</p>
      <p className="hist-msg" role="status" aria-live="polite">{msg}</p>
      <ul className="list">
        {batches.map((b) => (
          <li key={b.id} className="list-row batch-row">
            <span className="lr-main">
              <span className="batch-head">{formatDay(b.day)}, {nf(b.grams)} {b.unit || unit}</span>
              <BatchSummary r={b} />
              {open === b.id ? (
                <BatchForm purchase={b} idPrefix="sb" onCancel={() => setOpen(null)}
                  onSaved={(b) => { setLocal((l) => ({ base: serverBatches, map: { ...(l.base === serverBatches ? l.map : {}), [b.id]: b } })); setOpen(null); setMsg('Zapisano notatkę o partii.'); router.refresh(); }} />
              ) : (
                <button type="button" className="btn small text batch-edit" aria-label={`${hasBatch(b) ? 'Edytuj' : 'Dodaj'} notatkę o partii: zakup z ${formatDay(b.day)}`}
                  onClick={() => { setMsg(''); setOpen(b.id); }}>{hasBatch(b) ? 'Edytuj partię' : 'Dodaj notatkę o partii'}</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
