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

// „Większy tekst i przyciski” (POM-22): ustawienie tylko na tym urządzeniu; klasę na <html> ustawia też skrypt startowy w layout.js
export function BigChoice() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(document.documentElement.classList.contains('big-ui')); }, []);
  function toggle(e) {
    const next = e.target.checked;
    setOn(next);
    document.documentElement.classList.toggle('big-ui', next);
    try { if (next) localStorage.setItem('zielnik.big', '1'); else localStorage.removeItem('zielnik.big'); } catch {}
  }
  return (
    <label className="switch-row">
      <span>Większy tekst i przyciski<small className="muted" style={{ display: 'block', fontWeight: 400 }}>Powiększa pismo i przyciski. Dotyczy tylko tego urządzenia.</small></span>
      <input type="checkbox" className="switch" checked={on} onChange={toggle} />
    </label>
  );
}

// Szybki wybór w menu: Systemowy (domyślnie, jak w telefonie) → Jasny → Ciemny; „Systemowy” usuwa zapisany wybór
const LABELS = { auto: 'Systemowy', light: 'Jasny', dark: 'Ciemny' };
const NEXT = { auto: 'light', light: 'dark', dark: 'auto' };
export default function ThemeToggle({ variant }) {
  const [t, setT] = useState('auto');
  const [sysDark, setSysDark] = useState(false);
  useEffect(() => { setT(current()); setSysDark(systemDark()); }, []);
  const pick = (v) => { setT(v); apply(v); };
  if (variant === 'row') {
    return (
      <div className="list-row theme-row">
        <Icon name={t === 'dark' || (t === 'auto' && sysDark) ? 'moon' : 'sun'} /><span className="lr-main">Motyw</span>
        <ThemeSeg value={t} onPick={pick} small />
      </div>
    );
  }
  return <button type="button" className="linklike" onClick={() => pick(NEXT[t])}>Motyw: {LABELS[t]}</button>;
}

function ThemeSeg({ value, onPick, small }) {
  return (
    <div className={`seg${small ? ' seg-sm' : ''}`} role="radiogroup" aria-label="Motyw">
      {['auto', 'light', 'dark'].map((v) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onPick(v)}>{LABELS[v]}</button>
      ))}
    </div>
  );
}

// Wybór motywu w profilu: systemowy, jasny albo ciemny
export function ThemeChoice() {
  const [t, setT] = useState('auto');
  useEffect(() => { setT(current()); }, []);
  const pick = (v) => { setT(v); apply(v); };
  return <ThemeSeg value={t} onPick={pick} />;
}
