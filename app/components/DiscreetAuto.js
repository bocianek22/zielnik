'use client';
import { useEffect } from 'react';
import { discreetAuto, hideOnLeave, isDiscreet, setDiscreet } from '@/lib/discreet';

// POM-60: przy zejściu strony do tła (inna aplikacja, przełącznik, zablokowanie ekranu) włącza tryb dyskretny,
// jeśli użytkownik zaznaczył to w profilu. Bez widoku.
export default function DiscreetAuto() {
  useEffect(() => {
    const onVis = () => { if (hideOnLeave({ auto: discreetAuto(), visibility: document.visibilityState, discreet: isDiscreet() })) setDiscreet(true); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', onVis); };
  }, []);
  return null;
}
