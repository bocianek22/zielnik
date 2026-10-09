'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { expiryInfo } from '@/lib/expiry';
import { VIS } from '@/lib/visibility';
import { formLabel } from '@/lib/forms';
import Lightbox from './Lightbox';
import QuickActions from './QuickActions';
import RxPicker, { useOpenPrescriptions, rxField } from './RxPicker';
import { useQuickSave, SaveNote } from './useQuickSave';
import Icon from './Icon';
import { parseNum, decimalProps } from './num';
import { strainTags } from '@/lib/effects';
import { unitOf, quickValues, consumePlaceholder, buyPlaceholder } from '@/lib/units';

export const LOW_STOCK = 3; // g: poniżej tej ilości susz dostaje znacznik "Kończy się" (próg w gramach, więc nie dla ml)
const fmt = (n) => (n == null ? '–' : String(Number(n)).replace('.', ','));
// wyświetlanie liczb z polskim przecinkiem (wartości w danych zostają bez zmian)
export const dec = (n) => String(n).replace('.', ',');

// Edytowalne, osobiste pola zalogowanego użytkownika (autozapis po opuszczeniu pola)
// hidePrice: aplikacja natywna (lib/client.js); cena zostaje w stanie formularza, więc zapis jej nie kasuje
// form: postać odmiany; ilości i cena w jej jednostce (susz: g, olej i pen: ml)
export function OwnEntry({ strainId, strainName = '', form = 'susz', entry, onSaved, mates, hidePrice = false }) {
  const unit = unitOf(form);
  const qv = quickValues(form);
  const inUnit = unit === 'ml' ? 'mililitrach' : 'gramach';
  const [f, setF] = useState({
    rating: entry.rating ?? '', current: entry.current ?? 0, remaining: entry.remaining ?? 0, notes: entry.notes ?? '',
    visibility: entry.visibility ?? 'me',
    price: entry.price ?? '',
  });
  const [status, setStatus] = useState({ kind: 'idle', msg: '' });
  const last = useRef(JSON.stringify(f));
  // stan zmieniony z zewnątrz (szybkie akcje na wierzchu karty, wspólna pula) odświeża pola bez przeładowania
  const extCur = entry.current ?? 0;
  const extRem = entry.remaining ?? 0;
  useEffect(() => {
    setF((p) => (parseNum(p.current) === Number(extCur) && parseNum(p.remaining) === Number(extRem) ? p : { ...p, current: extCur, remaining: extRem }));
    // własny zapis „1,” wraca jako 1: tekst w polu zostaje, więc nie nadpisujemy go, żeby kolejne wyjście z pola nie zapisywało ponownie
    const prev = JSON.parse(last.current);
    if (parseNum(prev.current) !== Number(extCur) || parseNum(prev.remaining) !== Number(extRem)) last.current = JSON.stringify({ ...prev, current: extCur, remaining: extRem });
  }, [extCur, extRem]);
  const id = `e${strainId}`;
  const [buyG, setBuyG] = useState('');
  const [use, setUse] = useState('');
  const [rx, setRx] = useState(undefined); // POM-16: undefined = domyślna recepta (wybierze serwer)
  const rxList = useOpenPrescriptions(unit, buyG !== '');
  // osobne komunikaty (i „Cofnij”) przy polach zużycia i wykupu
  const useQs = useQuickSave(strainId);
  const buyQs = useQuickSave(strainId);
  // stan po zapisie lub cofnięciu: pola formularza i lista (onSaved) bez przeładowania
  function applyStock(r, extra) {
    const next = { ...f, current: r.current, ...(r.remaining !== undefined ? { remaining: r.remaining } : {}) };
    setF(next); last.current = JSON.stringify(next);
    onSaved({ current: r.current, ...(r.remaining !== undefined ? { remaining: r.remaining } : {}), ...extra });
  }

  async function buy() {
    const g = parseNum(buyG);
    if (g == null) return;
    if (!(g > 0)) { buyQs.show(`Podaj ilość w ${inUnit}, ${buyPlaceholder(form)}.`, true); return; }
    try {
      const cur = parseNum(f.current) || 0, rem = parseNum(f.remaining) || 0;
      const poolDelta = Math.min(g, Math.max(rem, 0));
      const r = await buyQs.save('purchase', g, { name: strainName, unit, delta: g, poolDelta }, rxField(rx));
      if (r.queued) {
        applyStock({ current: cur + g, remaining: rem - poolDelta }, { bought: g });
        setBuyG(''); setRx(undefined); buyQs.show(`Czeka na wysłanie: zakup ${dec(g)} ${unit}. Wyślę, gdy wróci sieć.`, false, { kind: 'purchase', queued: r.queued.id });
        return;
      }
      applyStock(r, { bought: r.bought ?? g });
      setBuyG(''); setRx(undefined); buyQs.show(`Zapisano zakup: ${dec(r.bought ?? g)} ${unit}`, false, r.id ? { kind: 'purchase', id: r.id } : null);
    } catch (e) { buyQs.show(e.message, true); }
  }

  async function consume() {
    const g = parseNum(use);
    if (g == null) return;
    if (!(g > 0)) { useQs.show(`Podaj ilość w ${inUnit}, ${consumePlaceholder(form)}.`, true); return; }
    try {
      const cur = parseNum(f.current) || 0;
      const delta = Math.min(g, Math.max(cur, 0));
      const r = await useQs.save('usage', g, { name: strainName, unit, delta, poolDelta: 0 });
      if (r.queued) {
        applyStock({ current: cur - delta }, { used: g });
        setUse(''); useQs.show(`Czeka na wysłanie: zużycie ${dec(g)} ${unit}. Wyślę, gdy wróci sieć.`, false, { kind: 'usage', queued: r.queued.id });
        return;
      }
      applyStock(r, { used: r.used });
      setUse('');
      useQs.show(r.stockShort ? `Zapisano zużycie ${dec(r.used)} ${unit} (zapisany stan był mniejszy, ustawiono 0 ${unit})` : `Zapisano zużycie ${dec(r.used)} ${unit}, zostało ${dec(r.current)} ${unit}`,
        false, r.id ? { kind: 'usage', id: r.id } : null);
    } catch (e) { useQs.show(e.message, true); }
  }
  async function undoWith(qs, key) {
    const r = await qs.undo();
    if (r) applyStock(r, { [key]: r[key] });
  }

  async function save() {
    const key = JSON.stringify(f);
    if (key === last.current) return;
    // liczby z przecinkiem zamieniamy tu, bo pola są tekstowe
    const nums = {};
    for (const [k, label] of [['rating', 'Ocena'], ['current', 'Mam teraz'], ['remaining', 'Do wykupienia'], ['price', 'Cena']]) {
      const v = parseNum(f[k]);
      if (Number.isNaN(v)) { setStatus({ kind: 'err', msg: `${label}: wpisz liczbę, np. 0,5.` }); return; }
      nums[k] = v === null ? '' : v;
    }
    setStatus({ kind: 'saving', msg: 'Zapisuję…' });
    try {
      // ilości wysyłamy tylko, gdy zmienił je użytkownik w tym polu (szybkie akcje zmieniają je osobno)
      const prev = JSON.parse(last.current);
      const body = { ...f, ...nums };
      if (parseNum(f.current) === parseNum(prev.current)) delete body.current;
      if (parseNum(f.remaining) === parseNum(prev.remaining)) delete body.remaining;
      const r = await api(`/api/strains/${strainId}/entry`, 'PUT', body);
      last.current = key;
      onSaved(r.entry);
      setStatus({ kind: 'ok', msg: 'Zapisano' });
      // nowa cena za gram (ml), a są zakupy tej odmiany bez kosztu (np. cenę wpisano po wykupie): propozycja uzupełnienia
      if (r.missingCost > 0 && nums.price > 0 && parseNum(prev.price) !== nums.price) setFill({ n: r.missingCost, price: nums.price, msg: '' });
    } catch (e) { setStatus({ kind: 'err', msg: e.message }); }
  }
  const [fill, setFill] = useState(null); // { n, price, msg }
  async function fillCosts() {
    try {
      const r = await api('/api/history/purchases/fill', 'POST', { strainId, pricePerG: fill.price });
      setFill({ n: 0, price: fill.price, msg: `Uzupełniono koszt zakupów: ${r.filled}.` });
    } catch (e) { setFill((p) => ({ ...p, msg: e.message })); }
  }
  const bind = (k) => ({ value: f[k], onChange: (e) => setF((p) => ({ ...p, [k]: e.target.value })), onBlur: save });

  return (
    <div className="entry mine">
      <div className="entry-who"><span>Twoje pola</span> <span className={`save-state ${status.kind}`} role="status">{status.msg}</span></div>
      <div className="entry-field">
        <label htmlFor={`${id}-r`}>Ocena</label>
        <input id={`${id}-r`} className="input" {...decimalProps} {...bind('rating')} />
      </div>
      <div className="entry-field">
        <label htmlFor={`${id}-c`}>Mam teraz ({unit})</label>
        <input id={`${id}-c`} className="input" {...decimalProps} {...bind('current')} />
      </div>
      <div className="entry-field">
        <label htmlFor={`${id}-m`}>Do wykupienia ({unit})</label>
        <input id={`${id}-m`} className="input" {...decimalProps} {...bind('remaining')} />
        {mates?.length > 0 && <small className="pool-note">Jedna pula z: <span className="dn">{mates.join(', ')}</span></small>}
      </div>
      <div className="entry-field notes">
        <label htmlFor={`${id}-n`}>Spostrzeżenia</label>
        <textarea id={`${id}-n`} className="input" rows={2} maxLength={1000} {...bind('notes')} />
        {entry.notesLocked && !f.notes && <small className="pool-note">Zapisana notatka jest zaszyfrowana i chwilowo nieczytelna (brak klucza na serwerze). Zostanie zachowana; wpisany tu nowy tekst ją zastąpi.</small>}
      </div>
      {!hidePrice && (
        <div className="entry-field price">
          <label htmlFor={`${id}-pr`}>Cena u mnie (zł/{unit}), tworzy średnią cen</label>
          <input id={`${id}-pr`} className="input" {...decimalProps} {...bind('price')} />
          {fill && (
            <div className="pool-note fill-offer" role="status">
              {fill.n > 0 && <>Zakupy tej odmiany bez ceny: {fill.n}. Uzupełnić po {dec(fill.price)} zł/{unit}?{' '}
                <button type="button" className="btn small ghost" onClick={fillCosts}>Uzupełnij</button>{' '}
                <button type="button" className="btn small text" onClick={() => setFill(null)}>Nie</button></>}
              {fill.msg}
            </div>
          )}
        </div>
      )}
      <div className="entry-field vis">
        <label htmlFor={`${id}-v`}>Kto widzi Twoją ocenę i opinię</label>
        <select id={`${id}-v`} className="input" value={f.visibility} onChange={(e) => setF((p) => ({ ...p, visibility: e.target.value }))} onBlur={save}>
          {VIS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div className="entry-field use">
        <label htmlFor={`${id}-u`}>Zużycie ({unit})</label>
        <div className="use-row">
          <input id={`${id}-u`} className="input" {...decimalProps} placeholder={consumePlaceholder(form)} value={use}
            onChange={(e) => setUse(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); consume(); } }} />
          <button type="button" className="btn small" onClick={consume}>Zużyj</button>
        </div>
        <div className="chips small">{qv.use.map((v) => <button key={v} type="button" className="chip use-chip" onClick={() => setUse(dec(v))}>{dec(v)} {unit}</button>)}</div>
        <SaveNote note={useQs.note} undoing={useQs.undoing} onUndo={() => undoWith(useQs, 'used')} />
      </div>
      <div className="entry-field buy">
        <label htmlFor={`${id}-b`}>Wykupiłem ({unit})</label>
        <div className="use-row">
          <input id={`${id}-b`} className="input" {...decimalProps} placeholder={buyPlaceholder(form)} value={buyG}
            onChange={(e) => setBuyG(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buy(); } }} />
          <button type="button" className="btn small" onClick={buy}>Dodaj zakup</button>
        </div>
        <RxPicker id={`${id}-rx`} list={rxList} value={rx} onChange={setRx} />
        <SaveNote note={buyQs.note} undoing={buyQs.undoing} onUndo={() => undoWith(buyQs, 'bought')} />
      </div>
    </div>
  );
}

export function OtherEntry({ e }) {
  return (
    <div className="entry other">
      <div className="entry-who"><Link href={`/u/${encodeURIComponent(e.username)}`}>{e.displayName || e.username}</Link></div>
      <div className="entry-field"><span className="lbl">Ocena</span><b>{fmt(e.rating)}</b></div>
      <div className="entry-field notes"><span className="lbl">Opinia</span><span>{e.notes || '–'}</span></div>
    </div>
  );
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Menu karty (rzadkie akcje): „Porównaj” i „Edytuj pola wspólne”. Zamyka się po kliknięciu poza nim.
function CardMenu({ name, cmpOn, onCmp, onEdit }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current?.open && !ref.current.contains(e.target)) ref.current.open = false; };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return (
    <details className="card-menu" ref={ref} onKeyDown={(e) => { if (e.key === 'Escape' && ref.current?.open) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); } }}>
      <summary aria-label={`Więcej akcji: ${name}`}><Icon name="more" size={22} /></summary>
      <div className="card-menu-list">
        <label className="check cmp-check"><input type="checkbox" checked={!!cmpOn} onChange={onCmp} /> <span>Porównaj</span></label>
        <button type="button" className="btn text small" onClick={() => { if (ref.current) ref.current.open = false; onEdit(); }}><Icon name="edit" size={18} />Edytuj pola wspólne</button>
      </div>
    </details>
  );
}

export default function StrainCard({ strain, meId, hidePrice = false, mates, low, cmpOn, onCmp, onEdit, onEntrySaved }) {
  const [expanded, setExpanded] = useState(false); // na telefonie szczegóły są domyślnie zwinięte
  const mine = strain.entries.find((e) => e.userId === meId);
  const others = strain.entries.filter((e) => e.userId !== meId);
  const rated = strain.entries.filter((e) => e.rating != null);
  const avg = rated.length ? (rated.reduce((a, e) => a + Number(e.rating), 0) / rated.length).toFixed(1) : null;

  const ex = expiryInfo(strain.expires_on);
  const photoSrc = `/api/strains/${strain.id}/photo?v=${strain.photo_v}`;
  const unit = unitOf(strain.form);
  const cur = Number(mine?.current) || 0;
  const rem = Number(mine?.remaining) || 0;
  const lowStock = unit === 'g' && mine && cur > 0 && cur <= (low ?? LOW_STOCK);
  const facts = [
    strain.thc != null && `THC ${dec(strain.thc)}%`,
    strain.cbd != null && `CBD ${dec(strain.cbd)}%`,
    strain.price_per_g != null && !hidePrice && `${dec(strain.price_per_g)} zł/${unit}`,
  ].filter(Boolean);
  const tags = strainTags(strain);
  // pigułka stanu zapasu; czytnik ekranu dostaje ten sam stan z „.quick-stock” w szybkich akcjach
  const stock = !mine ? null
    : cur > 0 ? [lowStock ? 'low' : 'ok', `Mam ${dec(Math.round(cur * 100) / 100)} ${unit}${lowStock ? ', kończy się' : ''}`]
    : ['none', rem > 0 ? `Brak w domu, ${dec(rem)} ${unit} do wykupienia` : 'Brak w domu'];

  return (
    <article className={`strain k-${strain.kind || 'none'}${expanded ? ' expanded' : ''}`} data-cat="stock">
      <header className="strain-head">
        {strain.photo_v ? (
          <div className="photo-link dn-img"><Lightbox className="strain-photo" src={photoSrc} alt={`Zdjęcie: ${strain.name}`} attr={strain.photo_attr} /></div>
        ) : (
          // bez inicjałów: nazwa nie może wyciekać w trybie dyskretnym
          <span className="strain-thumb" aria-hidden="true"><Icon name={unit === 'ml' ? 'drop' : 'jar'} size={26} /></span>
        )}
        <div className="strain-title">
          <h3><Link href={`/strains/${strain.id}`} className="dn">{strain.name}</Link></h3>
          <p className="strain-meta">
            <span className="dn">{strain.producer}</span>
            {strain.kind && <span className={`kind kind-${strain.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(strain.kind)}</span>}
            {strain.type?.toLowerCase() !== strain.kind && <span>{cap(strain.type)}</span>}
            {strain.form && strain.form !== 'susz' && <span>{formLabel(strain.form)}</span>}
          </p>
        </div>
        <div className="scores">
          <div className="score" title="Ocena końcowa">
            <b>{strain.final_rating != null ? dec(strain.final_rating) : '–'}</b><small>{strain.final_rating != null ? 'ocena' : 'brak'}</small>
          </div>
          {avg && <div className="score soft" title="Średnia ocen użytkowników">
            <b>{dec(avg)}</b><small>średnia ({rated.length})</small>
          </div>}
        </div>
      </header>

      <p className="strain-pills">
        {facts.map((f) => <span key={f} className="pill">{f}</span>)}
        {stock && <span className={`pill stock-${stock[0]}`} aria-hidden="true">{stock[1]}</span>}
        {ex?.expired && <span className="pill stock-low">Po terminie</span>}
        {ex?.soon && <span className="pill stock-low">Ważne jeszcze {ex.days} dni</span>}
      </p>

      {(strain.batch || strain.expires_on || strain.taste || tags.length > 0 || strain.terpenes?.length > 0 || strain.description) && (
        <div className="strain-more">
          {(strain.batch || strain.expires_on) && (
            <p className="strain-taste">
              {strain.batch && <>Seria {strain.batch}. </>}{strain.expires_on && <>Ważne do {strain.expires_on}.</>}
            </p>
          )}
          {strain.taste && <p className="strain-taste">Smak: {strain.taste}</p>}
          {tags.length > 0 && <div className="chips small">{tags.map((t) => <span key={t} className="chip tag">{t}</span>)}</div>}
          {strain.terpenes?.length > 0 && (
            <div className="chips small">{strain.terpenes.map((t) => <Link key={t} href={`/wiedza#t-${t.toLowerCase().split(' ')[0]}`} className="chip on static dn">{t}</Link>)}</div>
          )}
          {strain.description && (
            <details className="strain-desc"><summary>Opis</summary><p>{strain.description}</p></details>
          )}
        </div>
      )}

      {/* „Wykupiłem” zawsze na wierzchu: pierwszy zakup nowej odmiany bez rozwijania karty */}
      {mine && (
        <QuickActions strainId={strain.id} name={strain.name} form={strain.form} current={mine.current} remaining={mine.remaining} onSaved={(en) => { onEntrySaved(strain.id, en); }} />
      )}

      <div className="entries">
        {mine && <OwnEntry strainId={strain.id} strainName={strain.name} form={strain.form} entry={mine} mates={mates} hidePrice={hidePrice} onSaved={(en) => onEntrySaved(strain.id, en)} />}
        {others.map((e) => <OtherEntry key={e.userId} e={e} />)}
      </div>

      <div className="strain-foot">
        <button type="button" className="btn text small only-mobile" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? 'Zwiń' : 'Szczegóły'}<Icon name="chevronDown" size={18} className="chev" />
        </button>
        <CardMenu name={strain.name} cmpOn={cmpOn} onCmp={onCmp} onEdit={onEdit} />
      </div>
    </article>
  );
}
