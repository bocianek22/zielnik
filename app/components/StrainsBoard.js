'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import useNativeRefresh from './native/useNativeRefresh';
import { KINDS } from '@/lib/kinds';
import { FORMS } from '@/lib/forms';
import { TAG_LIST, strainTags } from '@/lib/effects';
import StrainCard from './StrainCard';
import StrainForm from './StrainForm';
import Icon from './Icon';
import { useHome } from './HomeStore';
import SearchSuggest from './SearchSuggest';
import { matches } from '@/lib/searchMatch';
import { strainItems, producerItems, flavorItems } from '@/lib/searchItems';
import { unitOf } from '@/lib/units';
import { revertOf } from '@/lib/offline-queue';
import { hasQueued, wasOptimistic } from '@/lib/offline-client';
import useQueueEvents from './useQueueEvents';

const avgOf = (s) => {
  const r = s.entries.filter((e) => e.rating != null);
  return r.length ? r.reduce((a, e) => a + Number(e.rating), 0) / r.length : null;
};

export default function StrainsBoard({ initialStrains, initialOptions, me }) {
  const { low, entrySaved: homeSaved, subscribe, sync, takeNewRequest } = useHome();
  const [strains, setStrains] = useState(initialStrains);
  const [options, setOptions] = useState(initialOptions);
  const [query, setQuery] = useState('');
  const [onlyStock, setOnlyStock] = useState(false);
  const [kindFilter, setKindFilter] = useState('');
  const [scope, setScope] = useState('all'); // 'all' | 'mine'
  const [formFilter, setFormFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(30); // liczba widocznych kart (szybsze przewijanie na telefonie) // '' | susz | olej | pen
  const [sortKey, setSortKey] = useState('new');
  const [dir, setDir] = useState('desc');
  const [formFor, setFormFor] = useState(null); // null | 'new' | id odmiany
  const [error, setError] = useState('');
  const [cmp, setCmp] = useState([]); // do 3 odmian do porównania

  const mine = (s) => s.entries.find((e) => e.userId === me.id) || { current: 0, remaining: 0 };
  const SORTS = {
    new: ['Najnowsze', (s) => s.id, 'desc'],
    name: ['Nazwa', (s) => s.name.toLowerCase(), 'asc'],
    producer: ['Producent', (s) => s.producer.toLowerCase(), 'asc'],
    current: ['Mam teraz (moja ilość)', (s) => Number(mine(s).current), 'desc'],
    remaining: ['Do wykupienia (moje)', (s) => Number(mine(s).remaining), 'desc'],
    thc: ['THC', (s) => s.thc, 'desc'],
    cbd: ['CBD', (s) => s.cbd, 'desc'],
    final: ['Ocena końcowa', (s) => s.final_rating, 'desc'],
    avg: ['Średnia ocen', avgOf, 'desc'],
    kind: ['Rodzaj', (s) => s.kind, 'asc'],
    type: ['Typ', (s) => s.type.toLowerCase(), 'asc'],
  };

  async function refresh() {
    const r = await api('/api/strains');
    setStrains(r.strains);
    setOptions(r.options);
    setFormFor(null);
  }

  // przeciągnięcie w aplikacji natywnej: dociąga listę, nie zamykając otwartego formularza
  useNativeRefresh(async () => { const r = await api('/api/strains'); setStrains(r.strains); setOptions(r.options); });

  // zmiana wpisu w stanie listy; „Do wykupienia” jest wspólne dla puli, więc aktualizujemy je we wszystkich odmianach z tej samej puli
  const applyEntry = useCallback((strainId, entry) => {
    const { bought: _b, used: _u, ...en } = entry;
    setStrains((list) => {
      const key = list.find((s) => s.id === strainId)?.pool_key;
      return list.map((s) => ({
        ...s,
        entries: s.entries.map((e) => {
          if (e.userId !== me.id) return e;
          if (s.id === strainId) return { ...e, ...en };
          return s.pool_key === key && en.remaining !== undefined ? { ...e, remaining: en.remaining } : e;
        }),
      }));
    });
  }, [me.id]);
  // zapisy z panelu „Dziś” (także te sprzed wczytania listy)
  useEffect(() => subscribe(applyEntry), [subscribe, applyEntry]);
  function entrySaved(strainId, rawEntry) {
    const s = strains.find((x) => x.id === strainId);
    applyEntry(strainId, rawEntry);
    homeSaved(strainId, rawEntry, { name: s?.name, form: s?.form }, true);
  }

  // Kolejka offline (POM-14): zapis usunięty z kolejki albo odrzucony przez serwer cofa stan pokazany od razu
  // (tylko dodany na tej stronie: po przeładowaniu lista pokazuje stan z serwera bez czekających zapisów);
  // wysłany ustawia stan z serwera, gdy dla tej odmiany nic już nie czeka (inaczej cofnęłoby to kolejne zapisy).
  useQueueEvents((d) => {
    const sid = d.item?.meta?.strainId;
    if (!sid || (d.item.kind !== 'usage' && d.item.kind !== 'purchase')) return;
    const e = strains.find((s) => s.id === sid)?.entries.find((x) => x.userId === me.id);
    if (!e) return;
    if ((d.type === 'removed' || d.type === 'rejected') && wasOptimistic(d.item.id)) {
      const r = revertOf(d.item);
      entrySaved(sid, {
        current: Math.max(Number(e.current) + r.dCur, 0),
        ...(r.dRem ? { remaining: Number(e.remaining) + r.dRem } : {}),
        ...(r.used ? { used: r.used } : {}), ...(r.bought ? { bought: r.bought } : {}),
      });
    } else if (d.type === 'sent' && d.data && !hasQueued((i) => i.meta?.strainId === sid && i.kind !== 'symptoms')) {
      entrySaved(sid, { current: d.data.current, ...(d.data.remaining !== undefined ? { remaining: d.data.remaining } : {}) });
    }
  });

  const pools = useMemo(() => {
    const m = new Map();
    strains.forEach((s) => m.set(s.pool_key, [...(m.get(s.pool_key) || []), s]));
    return m;
  }, [strains]);
  const matesOf = (s) => (pools.get(s.pool_key) || []).filter((o) => o.id !== s.id).map((o) => o.name);
  // sumy osobno dla g i ml (pula łączy tylko odmiany tej samej postaci, więc ma jedną jednostkę)
  const byUnit = (list, val) => list.reduce((a, s) => { a[unitOf(s.form)] += val(s); return a; }, { g: 0, ml: 0 });
  const remainingU = byUnit([...pools.values()].map((list) => list[0]), (s) => Number(mine(s).remaining) || 0);
  const stockU = byUnit(strains, (s) => Number(mine(s).current || 0));
  // panel „Dziś” dostaje sumy z pełnej listy (np. po edycji odmiany albo odświeżeniu)
  useEffect(() => {
    sync({ stock: stockU, remaining: remainingU, count: strains.length, current: Object.fromEntries(strains.map((s) => [s.id, Number(mine(s).current) || 0])) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strains]);

  const tastes = useMemo(() => [...new Set(strains.map((s) => s.taste).filter(Boolean))], [strains]);

  // podpowiedzi pod polem wyszukiwania: wszystko z listy, którą przeglądarka już ma; wybór ustawia filtr
  const suggestGroups = useMemo(() => [
    { key: 'strains', title: 'Odmiany', items: strainItems(strains) },
    { key: 'producers', title: 'Producenci', items: producerItems(strains) },
    { key: 'flavors', title: 'Terpeny i smaki', items: flavorItems(strains) },
  ], [strains]);
  const pickSuggestion = (item) => { setQuery(item.label); document.activeElement?.blur?.(); };

  const visible = useMemo(() => {
    const q = query.trim();
    const get = SORTS[sortKey][1];
    const sign = dir === 'asc' ? 1 : -1;
    return strains
      .filter((s) => {
        if (scope === 'mine') {
          const m = mine(s);
          const isMine = s.created_by === me.id || m.rating != null || Number(m.current) > 0 || Number(m.remaining) > 0 || m.notes;
          if (!isMine) return false;
        }
        if (onlyStock && !(Number(mine(s).current) > 0)) return false;
        if (kindFilter && s.kind !== kindFilter) return false;
        if (formFilter && (s.form || 'susz') !== formFilter) return false;
        if (tagFilter && !strainTags(s).includes(tagFilter)) return false;
        return !q || matches(`${s.name} ${s.producer} ${s.type} ${s.kind || ''} ${s.taste} ${(s.terpenes || []).join(' ')} ${strainTags(s).join(' ')}`, q);
      })
      .sort((a, b) => {
        const x = get(a), y = get(b);
        if (x == null && y == null) return a.name.localeCompare(b.name, 'pl');
        if (x == null) return 1;   // puste zawsze na końcu
        if (y == null) return -1;
        const c = typeof x === 'string' ? x.localeCompare(y, 'pl') : x - y;
        return c ? c * sign : a.name.localeCompare(b.name, 'pl');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strains, query, onlyStock, kindFilter, formFilter, tagFilter, scope, sortKey, dir, me.id]);

  // Szybka akcja „Nowa odmiana” z przycisku „+” (także po przejściu na stronę z ?new=1)
  useEffect(() => {
    const open = () => { setFormFor('new'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    window.addEventListener('zielnik:new-strain', open);
    const params = new URLSearchParams(window.location.search);
    if (takeNewRequest?.()) open();
    if (params.get('new') === '1') { open(); window.history.replaceState(null, '', '/'); }
    // filtr z podpowiedzi strony /szukaj (producent, terpen, smak)
    else if (params.get('q')) { setQuery(params.get('q').slice(0, 60)); window.history.replaceState(null, '', '/'); }
    return () => window.removeEventListener('zielnik:new-strain', open);
  }, []);
  useEffect(() => { setVisibleLimit(30); }, [query, onlyStock, kindFilter, formFilter, tagFilter, scope, sortKey, dir]);
  const activeFilters = [kindFilter, formFilter, tagFilter, scope === 'mine', onlyStock, sortKey !== 'new'].filter(Boolean).length;

  const canDelete = (s) => me.isAdmin || s.created_by === me.id;
  const done = () => refresh().catch((e) => setError(e.message));

  return (
    <>
      <div className="toolbar">
        <SearchSuggest value={query} onChange={setQuery} groups={suggestGroups} onPick={pickSuggestion} historyKey="zielnik.odmiany.ostatnie"
          onEnter={() => document.activeElement?.blur?.()}
          inputProps={{ placeholder: 'Szukaj: odmiana, producent, smak, terpen…', 'aria-label': 'Szukaj odmian', maxLength: 60 }} />
        <button type="button" className={`btn ghost only-mobile filter-btn${activeFilters ? ' active' : ''}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}
          aria-label={`Filtry i sortowanie${activeFilters ? ` (aktywne: ${activeFilters})` : ''}`}>
          <Icon name="filter" size={20} />{activeFilters ? <span className="count">{activeFilters}</span> : null}
        </button>
        {cmp.length >= 2 && <Link className="btn ghost" href={`/compare?ids=${cmp.join(',')}`}>Porównaj ({cmp.length})</Link>}
        <button className="btn add-btn" onClick={() => setFormFor('new')}><Icon name="plus" size={20} />Dodaj odmianę</button>
      </div>

      <div className={`filters-panel ${showFilters ? 'open' : ''}`}>
        <div className="filters-row">
          <div className="seg" role="tablist" aria-label="Postać produktu">
            {[['', 'Wszystko'], ...FORMS].map(([k, label]) => (
              <button key={k || 'all'} role="tab" aria-selected={formFilter === k} className={formFilter === k ? 'on' : ''} onClick={() => setFormFilter(k)}>{label}</button>
            ))}
          </div>
          <div className="seg" role="tablist" aria-label="Zakres widoku">
            {[['all', 'Wszystkie'], ['mine', 'Moje odmiany']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={scope === k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="filters-row">
          <div className="sortbox">
            <label htmlFor="sort">Sortuj</label>
            <select id="sort" className="input" value={sortKey}
              onChange={(e) => { setSortKey(e.target.value); setDir(SORTS[e.target.value][2]); }}>
              {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <button className="btn ghost small" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}
              aria-label={dir === 'asc' ? 'Rosnąco, kliknij by odwrócić' : 'Malejąco, kliknij by odwrócić'}>
              {dir === 'asc' ? '↑ rosnąco' : '↓ malejąco'}
            </button>
          </div>
          <div className="sortbox">
            <label htmlFor="tagf">Efekt</label>
            <select id="tagf" className="input" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="">Wszystkie</option>
              {TAG_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="filters-row">
          <div className="chips" role="group" aria-label="Filtr rodzaju">
            <button className={`chip ${kindFilter === '' ? 'on' : ''}`} onClick={() => setKindFilter('')}>Wszystkie</button>
            {KINDS.map((k) => (
              <button key={k.value} className={`chip kind-${k.value} ${kindFilter === k.value ? 'on' : ''}`}
                onClick={() => setKindFilter(kindFilter === k.value ? '' : k.value)}>{k.label}</button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} />
            Tylko te, które mam
          </label>
        </div>
        <div className="filters-row filters-foot">
          <a className="btn text small" href="/api/export"><Icon name="download" size={18} />Eksport CSV</a>
          <Link className="btn text small" href="/import">Import CSV</Link>
        </div>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}

      {formFor === 'new' && (
        <StrainForm options={options} tastes={tastes} hidePrice={me.hidePrices} onOptionsChange={setOptions} onDone={done} onCancel={() => setFormFor(null)} />
      )}

      {strains.length === 0 && formFor !== 'new' && (
        <div className="card empty">
          <Icon name="list" size={32} />
          <h2>Zielnik jest jeszcze pusty</h2>
          <p>Pierwszą odmianę dodasz przyciskiem „Dodaj odmianę” w panelu „Dziś”. Każdy użytkownik dostanie dla niej własne pola: ocenę, ilość, ilość do wykupienia i spostrzeżenia.</p>
        </div>
      )}
      {strains.length > 0 && visible.length === 0 && <p className="muted empty-inline">Nic nie pasuje do filtrów.</p>}

      {visible.slice(0, visibleLimit).map((s) => (formFor === s.id ? (
        <StrainForm key={s.id} strain={s} options={options} tastes={tastes} canDelete={canDelete(s)} hidePrice={me.hidePrices}
          onOptionsChange={setOptions} onDone={done} onCancel={() => setFormFor(null)} />
      ) : (
        <StrainCard key={s.id} strain={s} meId={me.id} hidePrice={me.hidePrices} mates={matesOf(s)} low={low} cmpOn={cmp.includes(s.id)} onCmp={() => setCmp((c) => (c.includes(s.id) ? c.filter((x) => x !== s.id) : [...c, s.id].slice(-3)))} onEdit={() => setFormFor(s.id)} onEntrySaved={entrySaved} />
      )))}
      {visible.length > visibleLimit && <button className="btn ghost block" onClick={() => setVisibleLimit((l) => l + 30)}>Pokaż więcej ({visible.length - visibleLimit})</button>}
    </>
  );
}
