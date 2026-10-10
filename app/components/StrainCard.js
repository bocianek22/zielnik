'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { expiryInfo } from '@/lib/expiry';
import { VIS } from '@/lib/visibility';
import { formLabel } from '@/lib/forms';
import QuickActions from './QuickActions';
import RxPicker, { useOpenPrescriptions, rxField } from './RxPicker';
import { useQuickSave, SaveNote } from './useQuickSave';
import Icon from './Icon';
import useFocusTrap from './useFocusTrap';
import useSheetDrag from './useSheetDrag';
import { parseNum, decimalProps } from './num';
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

// Miniatura w wierszu: samo zdjęcie (dotknięcie wiersza otwiera szczegóły, tam jest podgląd na cały ekran); przy błędzie kafelek rodzaju
function RowPhoto({ src, alt, fallback }) {
  const [failed, setFailed] = useState(false);
  const img = useRef(null);
  useEffect(() => { const el = img.current; setFailed(!!el && el.complete && el.naturalWidth === 0); }, [src]);
  if (failed) return fallback;
  return <img ref={img} className="strain-photo dn-img" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Menu wiersza („…”): rzadkie akcje w arkuszu zamykanym gestem w dół, uchwytem, tłem i Escape (jak „Więcej” w dolnym pasku).
// Arkusz idzie do <body>, żeby animacja karty ani przewijanie listy nie zmieniały jego położenia.
function CardMenu({ id, name, cmpOn, onCmp, onEdit }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = () => setOpen(false);
  useFocusTrap(ref, open, close);
  useSheetDrag(ref, open, close);
  return (
    <>
      <button type="button" className="card-menu-btn" aria-label={`Więcej akcji: ${name}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="more" size={22} />
      </button>
      {open && createPortal(
        <>
          <div className="rs-backdrop" onClick={close} aria-hidden="true" />
          <div className="row-sheet" role="dialog" aria-modal="true" aria-label={`Akcje: ${name}`} ref={ref}>
            <p className="rs-title dn">{name}</p>
            <div className="list">
              <Link href={`/strains/${id}`} className="list-row" onClick={close}>
                <span className="ic-dot sm" data-cat="strain"><Icon name="jar" size={18} /></span><span className="lr-main">Szczegóły odmiany</span><Icon name="chevronRight" size={18} className="lr-chev" />
              </Link>
              <label className="list-row rs-check cmp-check">
                <span className="ic-dot sm" data-cat="learn"><Icon name="shuffle" size={18} /></span>
                <span className="lr-main">Porównaj</span>
                <input type="checkbox" checked={!!cmpOn} onChange={onCmp} />
              </label>
              <button type="button" className="list-row" onClick={() => { close(); onEdit(); }}>
                <span className="ic-dot sm" data-cat="stock"><Icon name="edit" size={18} /></span><span className="lr-main">Edytuj pola wspólne</span>
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

export default function StrainCard({ strain, meId, low, cmpOn, onCmp, onEdit, onEntrySaved }) {
  const mine = strain.entries.find((e) => e.userId === meId);
  const ex = expiryInfo(strain.expires_on);
  const photoSrc = `/api/strains/${strain.id}/photo?v=${strain.photo_v}`;
  const unit = unitOf(strain.form);
  const cur = Number(mine?.current) || 0;
  const rem = Number(mine?.remaining) || 0;
  const lowStock = unit === 'g' && mine && cur > 0 && cur <= (low ?? LOW_STOCK);
  // stan zapasu pod oceną: krótko, bo wiersz ma jedną linię na dane; pełne zdanie czyta czytnik z „.quick-stock” w szybkich akcjach
  const stock = !mine ? null : cur > 0 ? [lowStock ? 'low' : 'ok', `${dec(Math.round(cur * 100) / 100)} ${unit}`] : ['none', rem > 0 ? 'do wykupu' : 'brak'];
  const rating = strain.final_rating;
  // bez inicjałów: nazwa nie może wyciekać w trybie dyskretnym
  const thumb = <span className="strain-thumb" aria-hidden="true"><Icon name={unit === 'ml' ? 'drop' : 'jar'} size={24} /></span>;
  const menu = <CardMenu id={strain.id} name={strain.name} cmpOn={cmpOn} onCmp={onCmp} onEdit={onEdit} />;

  return (
    <article className={`strain k-${strain.kind || 'none'}`} data-cat="stock">
      <header className="strain-head">
        {strain.photo_v ? (
          <RowPhoto src={photoSrc} alt={`Zdjęcie: ${strain.name}`} fallback={thumb} />
        ) : thumb}
        <div className="strain-title">
          <h3><Link href={`/strains/${strain.id}`} className="dn">{strain.name}</Link></h3>
          <p className="strain-meta">
            <span className="dn">{strain.producer}</span>
            {strain.kind && <span className={`kind kind-${strain.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(strain.kind)}</span>}
            {strain.form && strain.form !== 'susz' && <span>{formLabel(strain.form)}</span>}
            {strain.thc != null && <span>THC {dec(strain.thc)}%</span>}
            {ex?.expired && <span className="meta-warn">Po terminie</span>}
            {ex?.soon && <span className="meta-warn">Ważne jeszcze {ex.days} dni</span>}
          </p>
        </div>
        <div className="scores">
          <b className="score" title="Ocena końcowa">{rating != null ? <><span className="sr-only">Ocena końcowa: </span>{dec(rating)}</> : <span aria-label="Brak oceny">–</span>}</b>
          {stock && <span className={`pill sm stock-${stock[0]}`} aria-hidden="true">{stock[1]}</span>}
        </div>
      </header>

      {mine ? (
        <QuickActions strainId={strain.id} name={strain.name} form={strain.form} current={mine.current} remaining={mine.remaining} trailing={menu}
          onSaved={(en) => { onEntrySaved(strain.id, en); }} />
      ) : <div className="strain-foot">{menu}</div>}
    </article>
  );
}
