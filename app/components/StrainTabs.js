'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// UI 5 etap 6 (wariant B wybrany przez właściciela): karta odmiany w zakładkach zamiast długiej listy zwijanych sekcji.
// Wszystkie panele są w HTML od początku (ukryte przez `hidden`), więc stan formularzy przeżywa przełączanie, a wyszukiwanie
// na stronie i czytnik ekranu widzą treść po wybraniu zakładki. Wybór w adresie (#sklad), żeby link i „wstecz” trafiały w to samo.
export const STRAIN_TABS = [
  { key: 'przeglad', label: 'Przegląd', icon: 'chart' },
  { key: 'moje', label: 'Moje', icon: 'jar' },
  { key: 'sklad', label: 'Skład', icon: 'flask' },
  { key: 'opinie', label: 'Opinie', icon: 'users' },
];
const KEYS = STRAIN_TABS.map((t) => t.key);
export const tabFromHash = (hash) => {
  const k = String(hash || '').replace(/^#/, '');
  return KEYS.includes(k) ? k : null;
};

export default function StrainTabs({ panels, counts = {} }) {
  const [tab, setTab] = useState('przeglad');
  const btns = useRef({});
  useEffect(() => {
    const sync = () => { const k = tabFromHash(window.location.hash); if (k) setTab(k); };
    sync(); // adres znany dopiero w przeglądarce
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  function pick(k, focus = false) {
    setTab(k);
    window.history.replaceState(window.history.state, '', `#${k}`);
    if (focus) btns.current[k]?.focus();
  }
  // klawiatura jak w zakładkach ARIA: strzałki, Home, End
  function onKey(e) {
    const i = KEYS.indexOf(tab);
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: KEYS.length - 1 }[e.key];
    if (j == null) return;
    e.preventDefault();
    pick(KEYS[(j + KEYS.length) % KEYS.length], true);
  }
  const at = KEYS.indexOf(tab);
  return (
    <>
      <div className="dtabs" role="tablist" aria-label="Sekcje odmiany" style={{ '--i': at }} onKeyDown={onKey}>
        <span className="dtabs-ind" aria-hidden="true" />
        {STRAIN_TABS.map((t) => (
          <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-controls={`panel-${t.key}`} aria-selected={tab === t.key}
            tabIndex={tab === t.key ? 0 : -1} ref={(el) => { btns.current[t.key] = el; }} className="dtab" onClick={() => pick(t.key)}>
            <Icon name={t.icon} size={16} />{t.label}{counts[t.key] ? <span className="dtab-count">{counts[t.key]}</span> : null}
          </button>
        ))}
      </div>
      {STRAIN_TABS.map((t) => (
        <div key={t.key} role="tabpanel" id={`panel-${t.key}`} aria-labelledby={`tab-${t.key}`} className="dpanel stack" hidden={tab !== t.key}>
          {panels[t.key]}
        </div>
      ))}
    </>
  );
}
