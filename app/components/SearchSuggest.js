'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { highlight, rank, pushRecent } from '@/lib/searchMatch';
import { isDiscreet } from '@/lib/discreet';
import Icon from './Icon';

// Pole wyszukiwania z podpowiedziami (wzorzec ARIA combobox + listbox).
// groups: [{ key, title, items: [{ label, extra?, sub?, dn?, ...dowolne pola dla onPick }] }] – dane lokalne, filtrowane od 1 znaku.
// remote: { minChars, load(q, signal) => Promise<grupa> } – dane z serwera, z opóźnieniem i anulowaniem poprzedniego żądania.
// onPick(item) – wybór podpowiedzi albo ostatniego wyszukiwania (item.recent); onEnter(q) – Enter bez wybranej podpowiedzi.
// historyKey – klucz localStorage ostatnich wyszukiwań; w trybie dyskretnym historia nie jest ani zapisywana, ani pokazywana.

const DEBOUNCE_MS = 150;
const MIN_ROOM = 220; // poniżej tej wysokości listy przewijamy pole do góry ekranu

const plural = (n) => (n === 1 ? 'podpowiedź' : 'podpowiedzi');

function readHistory(key) {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}

export function rememberSearch(key, q) {
  if (!key || isDiscreet()) return;
  try { localStorage.setItem(key, JSON.stringify(pushRecent(readHistory(key), q))); } catch {}
}

function Marked({ text, query }) {
  return highlight(text, query).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>));
}

export default function SearchSuggest({ value, onChange, groups, remote, onPick, onEnter, historyKey, inputProps = {} }) {
  const uid = useId();
  const listId = `${uid}-list`;
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [discreet, setDiscreetState] = useState(false);
  const [remoteGroup, setRemoteGroup] = useState(null);
  const [active, setActive] = useState({ sig: '', i: -1 });
  const q = value.trim();

  useEffect(() => {
    const sync = () => setDiscreetState(isDiscreet());
    sync();
    setHistory(historyKey ? readHistory(historyKey) : []);
    window.addEventListener('zielnik:discreet', sync);
    return () => window.removeEventListener('zielnik:discreet', sync);
  }, [historyKey]);

  // Serwer: dopiero od minChars znaków, z opóźnieniem; stare wyniki zostają (filtrowane lokalnie), dopóki nie przyjdą nowe
  useEffect(() => {
    if (!remote) return undefined;
    if (q.length < (remote.minChars || 1)) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      remote.load(q, ctrl.signal).then((g) => { if (!ctrl.signal.aborted) setRemoteGroup(g); }).catch(() => {});
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
    // remote.load z rodzica może być nową funkcją przy każdym renderze; liczy się tylko zapytanie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, !!remote]);

  // poniżej minChars wyniki serwera są pomijane (bez czyszczenia stanu, żeby nie migały przy kasowaniu i ponownym wpisaniu)
  const remoteShown = remote && q.length >= (remote.minChars || 1) ? remoteGroup : null;
  const showHistory = !q && !discreet && history.length > 0;
  const shown = useMemo(() => {
    if (!q) return showHistory ? [{ key: 'recent', title: 'Ostatnie wyszukiwania', items: history.map((h) => ({ label: h, recent: true })) }] : [];
    return rank(remoteShown ? [...groups, remoteShown] : groups, q);
  }, [q, groups, remoteShown, showHistory, history]);

  const flat = useMemo(() => shown.flatMap((g) => g.items), [shown]);
  const sig = `${q}|${flat.map((x) => x.label).join('|')}`;
  const activeIndex = active.sig === sig ? active.i : -1;
  const expanded = open && flat.length > 0;
  const optId = (i) => `${uid}-o${i}`;

  const close = useCallback(() => setOpen(false), []);

  // dotknięcie poza polem i listą zamyka podpowiedzi
  useEffect(() => {
    if (!expanded) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) close(); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [expanded, close]);

  // Lista nie może schować się pod klawiaturą ekranową ani pod dolnym paskiem: wysokość liczona z visualViewport.
  // Gdy miejsca jest mało (pole nisko na ekranie), pole jedzie do góry, raz na otwarcie.
  useEffect(() => {
    if (!expanded) return undefined;
    let scrolled = false, raf = 0;
    const fit = () => {
      const pop = popRef.current, input = inputRef.current;
      if (!pop || !input) return;
      const vv = window.visualViewport;
      let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const nav = document.querySelector('.bottomnav');
      if (nav && getComputedStyle(nav).display !== 'none') bottom = Math.min(bottom, nav.getBoundingClientRect().top);
      const r = input.getBoundingClientRect();
      let room = bottom - r.bottom - 12;
      if (room < MIN_ROOM && !scrolled && r.top > 72) {
        scrolled = true;
        wrapRef.current.scrollIntoView({ block: 'start' });
        room = bottom - input.getBoundingClientRect().bottom - 12;
      }
      pop.style.maxHeight = `${Math.max(Math.floor(room), 132)}px`;
    };
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
    fit();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', later);
    vv?.addEventListener('scroll', later);
    window.addEventListener('resize', later);
    window.addEventListener('scroll', later, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener('resize', later);
      vv?.removeEventListener('scroll', later);
      window.removeEventListener('resize', later);
      window.removeEventListener('scroll', later);
    };
  }, [expanded]);

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(optId(activeIndex))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const remember = (text) => { rememberSearch(historyKey, text); if (historyKey) setHistory(readHistory(historyKey)); };

  function pick(item) {
    setOpen(false);
    remember(item.label);
    onPick?.(item);
  }

  function clearHistory() {
    try { localStorage.removeItem(historyKey); } catch {}
    setHistory([]);
    inputRef.current?.focus();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!flat.length) return;
      e.preventDefault();
      if (!expanded) { setOpen(true); setActive({ sig, i: e.key === 'ArrowDown' ? 0 : flat.length - 1 }); return; }
      const n = flat.length;
      const i = activeIndex < 0 ? (e.key === 'ArrowDown' ? 0 : n - 1) : (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      setActive({ sig, i });
    } else if (e.key === 'Enter') {
      if (expanded && activeIndex >= 0) { e.preventDefault(); pick(flat[activeIndex]); return; }
      setOpen(false);
      if (q) remember(q);
      onEnter?.(q, e);
    } else if (e.key === 'Escape') {
      // otwarta lista: Escape tylko ją zamyka (nie czyści pola, jak domyślnie robi type="search")
      if (expanded) { e.preventDefault(); setOpen(false); }
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  let idx = -1;
  return (
    <div className="search-wrap suggest" ref={wrapRef}>
      <Icon name="search" size={20} />
      <input {...inputProps} ref={inputRef} type="search" className={`input search ${inputProps.className || ''}`.trim()}
        role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId}
        aria-activedescendant={expanded && activeIndex >= 0 ? optId(activeIndex) : undefined}
        autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown} />
      <div className="suggest-pop" ref={popRef} hidden={!expanded} onMouseDown={(e) => e.preventDefault()}>
        <div id={listId} role="listbox" aria-label={q ? 'Podpowiedzi' : 'Ostatnie wyszukiwania'}>
          {expanded && shown.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`${uid}-g-${g.key}`}>
              <div id={`${uid}-g-${g.key}`} className="suggest-head" role="presentation">{g.title}</div>
              {g.items.map((item) => {
                idx += 1;
                const i = idx;
                return (
                  <div key={`${g.key}-${item.key ?? item.label}`} id={optId(i)} role="option" aria-selected={i === activeIndex}
                    className={`suggest-opt${i === activeIndex ? ' on' : ''}`} onClick={() => pick(item)}
                    onMouseMove={() => { if (i !== activeIndex) setActive({ sig, i }); }}>
                    {item.recent && <Icon name="clock" size={20} />}
                    <span className="sg-main">
                      <span className={item.dn ? 'sg-label dn' : 'sg-label'}>{item.recent ? item.label : <Marked text={item.label} query={q} />}</span>
                      {item.sub && <span className={item.subDn ? 'sg-sub dn' : 'sg-sub'}>{item.sub}</span>}
                    </span>
                    {item.hint && <span className="sg-hint">{item.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {expanded && !q && <button type="button" className="btn text small suggest-clear" onClick={clearHistory}>Wyczyść historię</button>}
      </div>
      <span className="sr-only" aria-live="polite">{expanded && q ? `${flat.length} ${plural(flat.length)}` : ''}</span>
    </div>
  );
}
