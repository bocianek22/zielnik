'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDay, todayPL } from '@/lib/date';
import { METHODS, PERIODS, methodLabel, periodLabel } from '@/lib/usage-meta';
import { parseNum, decimalProps } from '@/app/components/num';
import { BatchForm, BatchSummary } from '@/app/components/BatchNote';

const nf = (n, max = 2) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: max });
// 1 zakup, 2-4 zakupy (bez 12-14), 5 zakupów
const zakupy = (n) => (n === 1 ? 'zakup' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'zakupy' : 'zakupów');
const dec = (n) => (n == null || n === '' ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
const uOf = (r) => (r?.unit === 'ml' ? 'ml' : 'g'); // jednostka wpisu: susz w g, olej i pen w ml
const perUnit = (u) => (u === 'ml' ? 'ml' : 'gram');

// Zakupy albo zużycie w Historii z korektą: „Popraw” (gramy, data; przy zakupie cena za gram albo łączny koszt)
// i „Usuń” z potwierdzeniem. Lista (telefon) i tabela (szeroki ekran) są w DOM obie naraz, więc edytor jest jeden,
// nad nimi. Po zapisie odświeżamy stronę (podsumowanie miesiąca i wykres liczą się na serwerze).
// wartość pola „Recepta”: numer recepty, 'none' (jawnie bez recepty) albo '' (bez przypisania)
const rxOf = (row) => (row.prescriptionId ? String(row.prescriptionId) : row.noRx ? 'none' : '');

export default function Entries({ kind, rows: serverRows, prescriptions = [] }) {
  const purchase = kind === 'purchase';
  const base = purchase ? '/api/history/purchases' : '/api/history/usage';
  const router = useRouter();
  const [edit, setEdit] = useState(null); // { row, confirm, batch }
  // zapisana partia widoczna od razu; do czasu odświeżenia danych z serwera (wtedy serverRows to nowa tablica)
  const [local, setLocal] = useState({ base: null, map: {} });
  const rows = local.base === serverRows ? serverRows.map((r) => (local.map[r.id] ? { ...r, ...local.map[r.id] } : r)) : serverRows;
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [offer, setOffer] = useState(null); // { strainId, price, n, name }
  const box = useRef(null);
  const back = useRef(null);
  useEffect(() => { if (edit) box.current?.querySelector('input, button')?.focus(); }, [edit]);

  function open(row, confirm, e, batch = false) {
    back.current = e?.currentTarget ?? null;
    setEdit({ row, confirm, batch });
    setErr(''); setMsg(''); setOffer(null);
    setF({ grams: dec(row.grams), day: row.day, method: row.method || '', period: row.period || '', costMode: 'price', cost: row.cost != null ? dec(row.cost / row.grams) : '', rx: rxOf(row) });
  }
  function close() { setEdit(null); setErr(''); back.current?.focus?.(); }

  async function save(e) {
    e.preventDefault();
    const { row } = edit;
    const g = parseNum(f.grams), c = parseNum(f.cost);
    if (!(g > 0)) { setErr('Podaj ilość większą od zera, np. 0,5.'); return; }
    if (Number.isNaN(c) || c < 0) { setErr('Wpisz kwotę liczbą, np. 45 lub 45,50.'); return; }
    const body = {};
    if (g !== row.grams) body.grams = g;
    if (f.day && f.day !== row.day) body.date = f.day;
    if (!purchase) {
      if (f.method !== (row.method || '')) body.method = f.method || null;
      if (f.period !== (row.period || '')) body.period = f.period || null;
    }
    // POM-16: powiązanie z receptą: liczba = recepta, noRx = zakup prywatny, null = bez przypisania (szacunek)
    if (purchase && f.rx !== rxOf(row)) { if (f.rx === 'none') body.noRx = true; else body.prescriptionId = f.rx ? Number(f.rx) : null; }
    if (purchase && c != null) {
      const was = row.cost != null ? (f.costMode === 'price' ? Math.round((row.cost / row.grams) * 100) / 100 : row.cost) : null;
      // sama zmiana gramów: serwer przelicza koszt proporcjonalnie (bez zaokrąglonej ceny za gram z pola)
      if (c !== was) body[f.costMode === 'price' ? 'pricePerG' : 'cost'] = c;
    }
    if (!Object.keys(body).length) { close(); return; }
    setBusy(true); setErr('');
    try {
      const r = await api(`${base}/${row.id}`, 'PATCH', body);
      setEdit(null);
      setMsg('Zapisano poprawkę.');
      if (purchase && r.missingCost > 0 && body.pricePerG > 0) setOffer({ strainId: r.strainId, price: body.pricePerG, n: r.missingCost, name: row.name, unit: uOf(row) });
      router.refresh();
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setErr('');
    try {
      await api(`${base}/${edit.row.id}`, 'DELETE');
      setEdit(null);
      setMsg('Usunięto wpis.');
      router.refresh();
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  async function fill() {
    setBusy(true);
    try {
      const r = await api('/api/history/purchases/fill', 'POST', { strainId: offer.strainId, pricePerG: offer.price });
      setOffer(null);
      setMsg(`Uzupełniono koszt: ${r.filled} ${zakupy(r.filled)}.`);
      router.refresh();
    } catch (e2) { setMsg(e2.message); }
    finally { setBusy(false); }
  }

  const missing = purchase ? rows.filter((r) => r.cost == null).length : 0;
  const label = (r) => `${r.name}, ${formatDay(r.at)}, ${nf(r.grams)} ${uOf(r)}`;
  const eu = uOf(edit?.row);
  const actions = (r) => (
    <span className="hist-actions">
      <button type="button" className="btn small text" aria-label={`Popraw: ${label(r)}`} onClick={(e) => open(r, false, e)}>Popraw</button>
      {purchase && <button type="button" className="btn small text" aria-label={`Partia: ${label(r)}`} onClick={(e) => open(r, false, e, true)}>Partia</button>}
      <button type="button" className="btn small text hist-del" aria-label={`Usuń: ${label(r)}`} onClick={(e) => open(r, true, e)}>Usuń</button>
    </span>
  );
  // opis wpisu zużycia: sposób (jeśli podano) i pora; bez ocen
  const how = (r) => [methodLabel(r.method), periodLabel(r.period || r.autoPeriod)].filter(Boolean).join(', ');
  const noPrice = <span className="badge warn-badge">bez ceny</span>;
  const id = `fix-${kind}`;

  return (
    <>
      {missing > 0 && (
        <p className="alert note">{missing} {zakupy(missing)} na tej liście {zakupy(missing) === 'zakupy' ? 'nie mają' : 'nie ma'} ceny, więc nie wlicza się do kosztów. Użyj „Popraw” i wpisz cenę za gram (ml) albo łączny koszt.</p>
      )}
      <p className="hist-msg" role="status" aria-live="polite">{msg}</p>
      {offer && (
        <div className="alert note hist-offer">
          <p>Jeszcze {offer.n} {zakupy(offer.n)} odmiany <span className="dn">{offer.name}</span> bez ceny. Uzupełnić po {nf(offer.price)} zł/{offer.unit}?</p>
          <div className="hist-offer-btns">
            <button type="button" className="btn small" disabled={busy} onClick={fill}>Uzupełnij</button>
            <button type="button" className="btn small ghost" onClick={() => setOffer(null)}>Nie teraz</button>
          </div>
        </div>
      )}
      {edit && (
        <div ref={box} className="card hist-edit" role="group" aria-label={`${edit.confirm ? 'Usuń' : edit.batch ? 'Partia' : 'Popraw'}: ${label(edit.row)}`}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
          <p className="hist-edit-title"><span className="dn">{edit.row.name}</span>, {formatDay(edit.row.at)}, {nf(edit.row.grams)} {eu}</p>
          {edit.batch ? (
            <BatchForm purchase={edit.row} idPrefix="hb" onCancel={close}
              onSaved={(b) => { setLocal((l) => ({ base: serverRows, map: { ...(l.base === serverRows ? l.map : {}), [b.id]: { batchNoteLocked: false, ...b } } })); setEdit(null); setMsg('Zapisano notatkę o partii.'); back.current?.focus?.(); router.refresh(); }} />
          ) : edit.confirm ? (
            <>
              <p>{purchase
                ? `Usunąć ten zakup? Stan zmniejszy się o wykupione ${eu === 'ml' ? 'ml' : 'gramy'}, a pula „do wykupienia” wróci o tyle, ile z niej zdjęto.`
                : `Usunąć ten wpis zużycia? ${eu === 'ml' ? 'Mililitry wrócą' : 'Gramy wrócą'} do stanu.`}</p>
              <div className="hist-edit-btns">
                <button type="button" className="btn small danger" disabled={busy} onClick={remove}>{busy ? 'Usuwam…' : 'Tak, usuń'}</button>
                <button type="button" className="btn small ghost" onClick={close}>Anuluj</button>
              </div>
            </>
          ) : (
            <form onSubmit={save} className="hist-edit-form">
              <div className="field">
                <label htmlFor={`${id}-g`}>Ilość ({eu})</label>
                <input id={`${id}-g`} className="input" {...decimalProps} value={f.grams} onChange={(e) => setF((p) => ({ ...p, grams: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor={`${id}-d`}>Data</label>
                <input id={`${id}-d`} className="input" type="date" max={todayPL()} min="2000-01-01" value={f.day} onChange={(e) => setF((p) => ({ ...p, day: e.target.value }))} />
              </div>
              {!purchase && (
                <>
                  <div className="field">
                    <label htmlFor={`${id}-m`}>Sposób</label>
                    <select id={`${id}-m`} className="input" value={f.method} onChange={(e) => setF((p) => ({ ...p, method: e.target.value }))}>
                      <option value="">nie podano</option>
                      {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`${id}-p`}>Pora</label>
                    <select id={`${id}-p`} className="input" value={f.period} onChange={(e) => setF((p) => ({ ...p, period: e.target.value }))}>
                      <option value="">z godziny zapisu ({periodLabel(edit.row.autoPeriod) || '–'})</option>
                      {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </>
              )}
              {purchase && (prescriptions.some((p) => uOf(p) === eu) || f.rx) && (
                <div className="field">
                  <label htmlFor={`${id}-rx`}>Recepta</label>
                  <select id={`${id}-rx`} className="input" value={f.rx} onChange={(e) => setF((p) => ({ ...p, rx: e.target.value }))}>
                    <option value="">bez przypisania (szacunek z okresu ważności)</option>
                    <option value="none">bez recepty (zakup prywatny)</option>
                    {prescriptions.filter((p) => uOf(p) === eu || String(p.id) === f.rx).map((p) => (
                      <option key={p.id} value={p.id}>{nf(p.grams)} {uOf(p)}, od {formatDay(p.issued_on)}{p.valid_until ? ` do ${formatDay(p.valid_until)}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              {purchase && (
                <fieldset className="field hist-cost">
                  <legend>Koszt</legend>
                  <div className="hist-cost-modes">
                    <label><input type="radio" name={`${id}-m`} checked={f.costMode === 'price'} onChange={() => setF((p) => ({ ...p, costMode: 'price', cost: p.cost && toPrice(p) }))} /> cena za {perUnit(eu)} (zł/{eu})</label>
                    <label><input type="radio" name={`${id}-m`} checked={f.costMode === 'total'} onChange={() => setF((p) => ({ ...p, costMode: 'total', cost: p.cost && toTotal(p) }))} /> łączny koszt (zł)</label>
                  </div>
                  <input id={`${id}-c`} className="input" {...decimalProps} aria-label={f.costMode === 'price' ? `Cena za ${perUnit(eu)} w złotych` : 'Łączny koszt w złotych'}
                    placeholder={f.costMode === 'price' ? 'np. 45' : 'np. 450'} value={f.cost} onChange={(e) => setF((p) => ({ ...p, cost: e.target.value }))} />
                  {edit.row.cost == null && <small className="muted">Ten zakup nie ma ceny.</small>}
                </fieldset>
              )}
              <p className="muted small">{purchase
                ? 'Zmiana ilości zmienia stan i pulę „do wykupienia”. Zmiana daty niczego nie przelicza.'
                : 'Zmiana ilości zmienia stan (nie poniżej 0). Zmiana daty niczego nie przelicza.'}</p>
              <div className="hist-edit-btns">
                <button type="submit" className="btn small" disabled={busy}>{busy ? 'Zapisuję…' : 'Zapisz poprawkę'}</button>
                <button type="button" className="btn small ghost" onClick={close}>Anuluj</button>
              </div>
            </form>
          )}
          {err && <p className="field-err" role="alert">{err}</p>}
        </div>
      )}
      <ul className="list hist-list">
        {rows.map((r) => (
          <li key={r.id} className={`list-row${r.id === edit?.row.id ? ' editing' : ''}`}>
            <span className="lr-main"><span className="dn">{r.name}</span><span className="lr-sub">{formatDay(r.at)}{!purchase && how(r) && ` · ${how(r)}`}</span>{purchase && <BatchSummary r={r} />}{actions(r)}</span>
            <span className="lr-value">{nf(r.grams)} {uOf(r)}{purchase && (r.cost != null ? <small>{nf(r.cost)} zł</small> : <small>{noPrice}</small>)}</span>
          </li>
        ))}
      </ul>
      <div className="card hist-table"><div className="table-wrap"><table className="cmp hist-cmp">
        <thead><tr><th>Data</th><th>Odmiana</th><th className="num">Ilość</th>{!purchase && <th>Sposób i pora</th>}{purchase && <th className="num">Koszt</th>}<th><span className="sr-only">Akcje</span></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className={r.id === edit?.row.id ? 'editing' : undefined}>
            <td>{formatDay(r.at)}</td><td><span className="dn">{r.name}</span>{purchase && <BatchSummary r={r} />}</td><td className="num">{nf(r.grams)} {uOf(r)}</td>
            {!purchase && <td>{how(r)}</td>}
            {purchase && <td className="num">{r.cost != null ? `${nf(r.cost)} zł` : noPrice}</td>}
            <td className="hist-act-cell">{actions(r)}</td>
          </tr>
        ))}</tbody>
      </table></div></div>
    </>
  );
}

// przeliczenie pola kosztu przy zmianie trybu (cena za gram <-> łączny koszt) dla bieżącej ilości
function toPrice(p) {
  const g = parseNum(p.grams), c = parseNum(p.cost);
  return g > 0 && c >= 0 ? dec(c / g) : p.cost;
}
function toTotal(p) {
  const g = parseNum(p.grams), c = parseNum(p.cost);
  return g > 0 && c >= 0 ? dec(c * g) : p.cost;
}
