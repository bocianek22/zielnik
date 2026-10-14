'use client';
import { useSyncExternalStore } from 'react';
import Icon from './Icon';
import { isDiscreet, setDiscreet } from '@/lib/discreet';

const subscribe = (cb) => { window.addEventListener('zielnik:discreet', cb); return () => window.removeEventListener('zielnik:discreet', cb); };

// POM-60: „Ukryj nazwy teraz” w arkuszu „Więcej” (dotąd tylko dwa dotknięcia logo albo profil). Przełącza tryb dyskretny.
export default function HideNowRow() {
  const on = useSyncExternalStore(subscribe, isDiscreet, () => false);
  return (
    <button type="button" className="list-row hide-now" aria-pressed={on} onClick={() => setDiscreet(!on)}>
      <Icon name="shield" /><span className="lr-main">{on ? 'Pokaż nazwy' : 'Ukryj nazwy teraz'}</span>
    </button>
  );
}
