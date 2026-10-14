'use client';
import { useEffect } from 'react';
import { discreetAuto, hideOnLeave, isDiscreet, setDiscreet } from '@/lib/discreet';

// POM-60: przy zejściu strony do tła (inna aplikacja, blokada ekranu, zamknięcie karty) włącza tryb dyskretny, jeśli
// użytkownik zaznaczył to w profilu, i zasłania nazwy odsłonięte dotknięciem. Bez widoku.
export default function DiscreetAuto() {
  useEffect(() => {
    // pagehide przychodzi, zanim visibilityState zmieni się na hidden
    const onLeave = (e) => {
      const visibility = e.type === 'pagehide' ? 'hidden' : document.visibilityState;
      if (!discreetAuto() || visibility !== 'hidden') return;
      document.querySelectorAll('[data-dn-open]').forEach((el) => { delete el.dataset.dnOpen; });
      if (hideOnLeave({ auto: true, visibility, discreet: isDiscreet() })) setDiscreet(true);
    };
    document.addEventListener('visibilitychange', onLeave);
    window.addEventListener('pagehide', onLeave);
    return () => { document.removeEventListener('visibilitychange', onLeave); window.removeEventListener('pagehide', onLeave); };
  }, []);
  return null;
}
