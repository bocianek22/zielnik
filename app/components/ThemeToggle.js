'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';

// Motyw zapamiętywany w tej przeglądarce: 'light' | 'dark', brak wpisu = jak w systemie
function current() {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || t === 'light' ? t : 'auto';
}
function apply(next) {
  const root = document.documentElement;
  if (next === 'auto') delete root.dataset.theme; else root.dataset.theme = next;
  try { if (next === 'auto') localStorage.removeItem('zielnik.theme'); else localStorage.setItem('zielnik.theme', next); } catch {}
}
const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

// Szybki przełącznik w menu: odwraca to, co widać teraz (także gdy motyw wynika z systemu)
export default function ThemeToggle({ variant }) {
  const [dark, setDark] = useState(false);
  useEffect(() => { const t = current(); setDark(t === 'dark' || (t === 'auto' && systemDark())); }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    apply(next ? 'dark' : 'light');
  }
  const label = dark ? 'Tryb jasny' : 'Tryb ciemny';
  if (variant === 'row') {
    return (
      <button type="button" className="list-row" onClick={toggle}>
        <Icon name={dark ? 'sun' : 'moon'} /><span className="lr-main">{label}</span>
      </button>
    );
  }
  return <button type="button" className="linklike" onClick={toggle}>{label}</button>;
}

// Wybór motywu w profilu: systemowy, jasny albo ciemny
export function ThemeChoice() {
  const [t, setT] = useState('auto');
  useEffect(() => { setT(current()); }, []);
  const pick = (v) => { setT(v); apply(v); };
  return (
    <div className="seg" role="radiogroup" aria-label="Motyw">
      {[['auto', 'Systemowy'], ['light', 'Jasny'], ['dark', 'Ciemny']].map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={t === v} className={t === v ? 'on' : ''} onClick={() => pick(v)}>{l}</button>
      ))}
    </div>
  );
}
