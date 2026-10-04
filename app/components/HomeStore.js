'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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

  // lista po wczytaniu i po każdej zmianie przekazuje sumy policzone z pełnych danych (np. po edycji odmiany)
  const sync = useCallback((s) => {
    setStock(s.stock); setRemaining(s.remaining); setCount(s.count);
    setRecent((list) => list.map((x) => (s.current[x.id] === undefined ? x : { ...x, current: s.current[x.id] })));
  }, []);

  const value = useMemo(() => ({
    boughtU, series, recent, stock, remaining, count, low, limit, setLimit, savePref, setLow, entrySaved, subscribe, sync,
  }), [boughtU, series, recent, stock, remaining, count, low, limit, entrySaved, subscribe, sync]);
  return <Ctx.Provider value={value}><div className="stack">{children}</div></Ctx.Provider>;
}
