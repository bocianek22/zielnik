'use client';
import { useEffect } from 'react';
import { isPageLink, transition } from './native/behaviors';
import { isNative } from './native/bridge';

// Płynne przejścia między ekranami w przeglądarce (B4): View Transitions API tam, gdzie jest, bez niego i przy „ogranicz ruch”
// nic się nie dzieje (transition() sam to sprawdza). Nawigację nadal robi Next; my tylko owijamy ją przejściem, a klasa
// `vt-active` na <html> włącza reguły z system.css. W aplikacji natywnej to samo robi NativeShell, więc tu nic.
// Krótszy limit czekania niż w aplikacji (350 ms): wolna sieć nie może zamrażać ekranu po stuknięciu.
const WAIT_MS = 350;

export default function WebTransitions() {
  useEffect(() => {
    if (isNative() || typeof document.startViewTransition !== 'function') return;
    const onNav = (e) => { if (isPageLink(e)) transition(false, WAIT_MS); };
    document.addEventListener('click', onNav, true);
    return () => document.removeEventListener('click', onNav, true);
  }, []);
  return null;
}
