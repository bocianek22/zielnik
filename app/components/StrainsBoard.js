'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { KINDS } from '@/lib/kinds';
import { FORMS } from '@/lib/forms';
import { TAG_LIST, strainTags } from '@/lib/effects';
import StrainCard from './StrainCard';
import StrainForm from './StrainForm';

const avgOf = (s) => {
  const r = s.entries.filter((e) => e.rating != null);
  return r.length ? r.reduce((a, e) => a + Number(e.rating), 0) / r.length : null;
};

export default function StrainsBoard({ initialStrains, initialOptions, me, usage = { perDay: 0, cost: 0 }, bought = { grams: 0, cost: 0 } }) {
  const [boughtG, setBoughtG] = useState(bought.grams);
  const [low, setLow] = useState(3);      // próg "Kończy się" (g), zapisywany w tej przeglądarce
  const [limit, setLimit] = useState(0);  // miesięczny limit wykupu (g), zapisywany w tej przeglądarce
  useEffect(() => {
    try {
      setLow(Number(localStorage.getItem('zielnik.low') ?? 3));
      setLimit(Number(localStorage.getItem('zielnik.limit') ?? 0));
    } catch {}
  }, []);
  const savePref = (key, set) => (e) => {
    set(e.target.value === '' ? 0 : Number(e.target.value));
    try { localStorage.setItem(key, e.target.value || '0'); } catch {}
  };
  const dailyUse = usage.perDay;
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

  // "Do wykupienia" jest wspólne dla puli, więc aktualizujemy je we wszystkich odmianach z tej samej puli
  function entrySaved(strainId, rawEntry) {
    const { bought: b, ...entry } = rawEntry;
    if (b) setBoughtG((x) => x + b);
    setStrains((list) => {
      const key = list.find((s) => s.id === strainId)?.pool_key;
      return list.map((s) => ({
        ...s,
        entries: s.entries.map((e) => {
          if (e.userId !== me.id) return e;
          if (s.id === strainId) return { ...e, ...entry };
          return s.pool_key === key && entry.remaining !== undefined ? { ...e, remaining: entry.remaining } : e;
        }),
      }));
    });
  }

  const pools = useMemo(() => {
    const m = new Map();
    strains.forEach((s) => m.set(s.pool_key, [...(m.get(s.pool_key) || []), s]));
    return m;
  }, [strains]);
  const matesOf = (s) => (pools.get(s.pool_key) || []).filter((o) => o.id !== s.id).map((o) => o.name);
  const totalRemaining = [...pools.values()].reduce((a, list) => a + Number(mine(list[0]).remaining), 0);

  const totalStock = strains.reduce((a, s) => a + Number(mine(s).current || 0), 0);

  const tastes = useMemo(() => [...new Set(strains.map((s) => s.taste).filter(Boolean))], [strains]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
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
        return !q || `${s.name} ${s.producer} ${s.type} ${s.kind || ''} ${s.taste} ${(s.terpenes || []).join(' ')} ${strainTags(s).join(' ')}`.toLowerCase().includes(q);
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
    if (new URLSearchParams(window.location.search).get('new') === '1') { open(); window.history.replaceState(null, '', '/'); }
    return () => window.removeEventListener('zielnik:new-strain', open);
  }, []);
  useEffect(() => { setVisibleLimit(30); }, [query, onlyStock, kindFilter, formFilter, tagFilter, scope, sortKey, dir]);
  const activeFilters = [kindFilter, formFilter, tagFilter, scope === 'mine', onlyStock, sortKey !== 'new'].filter(Boolean).length;

  const canDelete = (s) => me.isAdmin || s.created_by === me.id;
  const done = () => refresh().catch((e) => setError(e.message));

  return (
    <div className="stack">
      <div className="toolbar">
        <input className="input search" type="search" placeholder="Szukaj: odmiana, producent, smak, terpen…" aria-label="Szukaj"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        {cmp.length >= 2 && <Link className="btn ghost" href={`/compare?ids=${cmp.join(',')}`}>Porównaj ({cmp.length})</Link>}
        <button className="btn" onClick={() => setFormFor('new')}>Dodaj odmianę</button>
      </div>

      <button type="button" className="btn ghost only-mobile" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
        Filtry i sortowanie{activeFilters ? ` (${activeFilters})` : ''}
      </button>
      <div className={`toolbar filters-panel ${showFilters ? 'open' : ''}`}>
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
        <a className="btn ghost small" href="/api/export">Eksport CSV</a>
        <Link className="btn ghost small" href="/import">Import CSV</Link>
      </div>
      <p className="muted">
        {dailyUse > 0 && totalStock > 0
          ? <>Średnie zużycie: <b>{Number(dailyUse.toFixed(2))} g/dzień</b>. Twój zapas ({Number(totalStock.toFixed(2))} g) starczy na ok. <b>{Math.floor(totalStock / dailyUse)} dni</b>.</>
          : <>Zapisuj zużycie w karcie odmiany (pole „Zużycie”), a policzę średnie tempo i prognozę, na ile dni starczy zapasu.</>}
      </p>
      <p className="muted">
        Wykupiono w tym miesiącu: <b>{Number(boughtG.toFixed(2))} g</b>
        {bought.cost > 0 && <> (ok. {Number(bought.cost.toFixed(2))} zł)</>}
        {limit > 0 && <>, limit {limit} g, zostało <b>{Number(Math.max(limit - boughtG, 0).toFixed(2))} g</b></>}.
      </p>
      <details className="prefs">
        <summary>Ustawienia (na tym urządzeniu)</summary>
        <div className="row">
          <div className="field"><label htmlFor="pref-low">Próg „Kończy się” (g)</label>
            <input id="pref-low" className="input" type="number" min="0" step="0.5" inputMode="decimal" value={low || ''} onChange={savePref('zielnik.low', setLow)} /></div>
          <div className="field"><label htmlFor="pref-limit">Miesięczny limit wykupu (g)</label>
            <input id="pref-limit" className="input" type="number" min="0" step="1" inputMode="numeric" value={limit || ''} onChange={savePref('zielnik.limit', setLimit)} /></div>
        </div>
      </details>
      {usage.cost > 0 && <p className="muted">Koszt zużycia z ostatnich 30 dni: <b>{Number(usage.cost.toFixed(2))} zł</b></p>}
      {totalRemaining > 0 && (
        <p className="muted">Do wykupienia łącznie: <b>{Number(totalRemaining.toFixed(2))} g</b> (odmiany z jednej puli liczone raz).</p>
      )}
      {error && <div className="alert error" role="alert">{error}</div>}

      {formFor === 'new' && (
        <StrainForm options={options} tastes={tastes} onOptionsChange={setOptions} onDone={done} onCancel={() => setFormFor(null)} />
      )}

      {strains.length === 0 && formFor !== 'new' && (
        <div className="card empty">
          <h2>Zielnik jest jeszcze pusty</h2>
          <p className="muted">Dodaj pierwszą odmianę. Każdy użytkownik dostanie dla niej własne pola: ocenę, ilość, ilość do wykupienia i spostrzeżenia.</p>
        </div>
      )}
      {strains.length > 0 && visible.length === 0 && <p className="muted">Nic nie pasuje do filtrów.</p>}

      {visible.slice(0, visibleLimit).map((s) => (formFor === s.id ? (
        <StrainForm key={s.id} strain={s} options={options} tastes={tastes} canDelete={canDelete(s)}
          onOptionsChange={setOptions} onDone={done} onCancel={() => setFormFor(null)} />
      ) : (
        <StrainCard key={s.id} strain={s} meId={me.id} mates={matesOf(s)} low={low} cmpOn={cmp.includes(s.id)} onCmp={() => setCmp((c) => (c.includes(s.id) ? c.filter((x) => x !== s.id) : [...c, s.id].slice(-3)))} onEdit={() => setFormFor(s.id)} onEntrySaved={entrySaved} />
      )))}
      {visible.length > visibleLimit && <button className="btn ghost" onClick={() => setVisibleLimit((l) => l + 30)}>Pokaż więcej ({visible.length - visibleLimit})</button>}
    </div>
  );
}
