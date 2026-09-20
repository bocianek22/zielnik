'use client';
import { useEffect, useState } from 'react';

// Przełącznik trybu ciemnego (zapamiętywany w tej przeglądarce)
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === 'dark'); }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('zielnik.theme', next ? 'dark' : 'light'); } catch {}
  }
  return <button type="button" className="linklike" onClick={toggle}>{dark ? 'Tryb jasny' : 'Tryb ciemny'}</button>;
}
