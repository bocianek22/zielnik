'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { revertOf } from '@/lib/offline-queue';
import { hasQueued, wasOptimistic } from '@/lib/offline-client';
import useQueueEvents from './useQueueEvents';

// Wspólny stan ekranu głównego: panel „Dziś” (renderowany od razu, z lekkich danych) i lista odmian (strumieniowana
// w Suspense, wczytuje się później). Panel nie czeka na listę; zapisy z jednej strony widzi druga.
const Ctx = createContext(null);
export const useHome = () => useContext(Ctx);

const unitOf = (form) => (form === 'olej' || form === 'pen' ? 'ml' : 'g');

export default function HomeStore({ children, bought, series: initialSeries, summary }) {
  const [boughtU, setBoughtU] = useState({ g: bought.grams, ml: bought.ml || 0 });
  const [series, setSeries] = useState(initialSeries);
  const [recent, setRecent] = useState(summary.recent);       // [{ id, name, form, current }], ostatnio używane pierwsze
  const [stock, setStock] = useState(summary.stock);         // { g, ml }: suma moich stanów
  const [remaining, setRemaining] = useState(summary.remaining); // { g, ml }: do wykupienia, każda pula raz
  const [count, setCount] = useState(summary.count);         // liczba odmian w zielniku
  const [low, setLow] = useState(3);      // próg „Kończy się” (g), zapisywany w tej przeglądarce
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

  // zapisy zrobione w panelu, zanim lista się wczytała, lista odtwarza po wczytaniu (wpisy są bezwzględne, więc powtórka nic nie psuje)
  const log = useRef([]);
  const listeners = useRef(new Set());
  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    log.current.forEach(([id, en]) => fn(id, en));
    return () => listeners.current.delete(fn);
  }, []);

  // meta: { form, name } odmiany; prev: poprzedni stan (do przeliczenia zapasu); fromList: zapis z karty na liście
  const entrySaved = useCallback((strainId, rawEntry, meta = {}, fromList = false) => {
    const { bought: b, used } = rawEntry;
    const unit = unitOf(meta.form);
    if (b) setBoughtU((x) => ({ ...x, [unit]: x[unit] + b }));
    // zapisane zużycie trafia do dzisiejszego słupka wykresu; ujemne („Cofnij”) zdejmuje je ze słupka
    const sk = unit === 'ml' ? 'ml' : 'grams';
    if (used) setSeries((list) => list.map((d, i) => (i === list.length - 1 ? { ...d, [sk]: Math.max((Number(d[sk]) || 0) + Number(used), 0) } : d)));
    const cur = rawEntry.current;
    setRecent((list) => {
      const known = list.find((x) => x.id === strainId);
      if (used > 0) {
        return [{ id: strainId, name: meta.name ?? known?.name ?? '', form: meta.form ?? known?.form, current: cur ?? known?.current ?? 0 },
          ...list.filter((x) => x.id !== strainId)].slice(0, 5);
      }
      return cur === undefined || !known ? list : list.map((x) => (x.id === strainId ? { ...x, current: Number(cur) } : x));
    });
    if (!fromList) {
      if (cur !== undefined && meta.prev !== undefined) setStock((s) => ({ ...s, [unit]: Math.max(s[unit] + Number(cur) - Number(meta.prev), 0) }));
      log.current.push([strainId, rawEntry]);
      listeners.current.forEach((fn) => fn(strainId, rawEntry));
    }
  }, []);

  // Kolejka offline, zanim lista się wczyta (potem obsługuje ją lista i przekazuje tu przez entrySaved): lista przyjdzie
  // ze stanem serwera, więc odrzucony/usunięty zapis wypada z odtwarzanych wpisów, a panel cofa tylko swoje sumy;
  // wysłany dopisuje stan z serwera, żeby lista nie pokazała stanu sprzed wysłania.
  const recentRef = useRef(recent);
  useEffect(() => { recentRef.current = recent; }, [recent]);
  useQueueEvents((d) => {
    if (listeners.current.size) return;
    const sid = d.item?.meta?.strainId;
    if (!sid || (d.item.kind !== 'usage' && d.item.kind !== 'purchase')) return;
    if ((d.type === 'removed' || d.type === 'rejected') && wasOptimistic(d.item.id)) {
      log.current = log.current.filter(([id]) => id !== sid);
      const r = revertOf(d.item);
      const unit = d.item.meta.unit === 'ml' ? 'ml' : 'g';
      if (r.bought) setBoughtU((x) => ({ ...x, [unit]: Math.max(x[unit] + r.bought, 0) }));
      const sk = unit === 'ml' ? 'ml' : 'grams';
      if (r.used) setSeries((list) => list.map((x, i) => (i === list.length - 1 ? { ...x, [sk]: Math.max((Number(x[sk]) || 0) + r.used, 0) } : x)));
      if (r.dCur) setStock((x) => ({ ...x, [unit]: Math.max(x[unit] + r.dCur, 0) }));
      if (r.dRem) setRemaining((x) => ({ ...x, [unit]: Math.max(x[unit] + r.dRem, 0) }));
      setRecent((list) => list.map((x) => (x.id === sid ? { ...x, current: Math.max(Number(x.current) + r.dCur, 0) } : x)));
    } else if (d.type === 'sent' && d.data && !hasQueued((i) => i.meta?.strainId === sid && i.kind !== 'symptoms')) {
      const en = { current: d.data.current, ...(d.data.remaining !== undefined ? { remaining: d.data.remaining } : {}) };
      log.current.push([sid, en]);
      setRecent((list) => list.map((x) => (x.id === sid ? { ...x, current: Number(en.current) } : x)));
    }
  });

  // „Dodaj odmianę” z panelu, zanim lista się wczytała: lista otworzy formularz po zamontowaniu
  const wantNew = useRef(false);
  useEffect(() => {
    const on = () => { if (!listeners.current.size) wantNew.current = true; };
    window.addEventListener('zielnik:new-strain', on);
    return () => window.removeEventListener('zielnik:new-strain', on);
  }, []);
  const takeNewRequest = useCallback(() => { const w = wantNew.current; wantNew.current = false; return w; }, []);

  // lista po wczytaniu i po każdej zmianie przekazuje sumy policzone z pełnych danych (np. po edycji odmiany)
  const sync = useCallback((s) => {
    setStock(s.stock); setRemaining(s.remaining); setCount(s.count);
    setRecent((list) => list.map((x) => (s.current[x.id] === undefined ? x : { ...x, current: s.current[x.id] })));
  }, []);

  const value = useMemo(() => ({
    boughtU, series, recent, stock, remaining, count, low, limit, setLimit, savePref, setLow, entrySaved, subscribe, sync, takeNewRequest,
  }), [boughtU, series, recent, stock, remaining, count, low, limit, entrySaved, subscribe, sync, takeNewRequest]);
  return <Ctx.Provider value={value}><div className="stack">{children}</div></Ctx.Provider>;
}
