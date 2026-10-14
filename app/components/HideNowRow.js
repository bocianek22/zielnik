'use client';
import { useSyncExternalStore } from 'react';
import Icon from './Icon';
import { isDiscreet, setDiscreet } from '@/lib/discreet';

const subscribe = (cb) => { window.addEventListener('zielnik:discreet', cb); return () => window.removeEventListener('zielnik:discreet', cb); };

// POM-60: „Ukryj nazwy” w menu „Więcej” (dotąd tylko dwa dotknięcia logo albo profil). Przełącznik ze stałą nazwą
// i aria-pressed (czytnik: „Ukryj nazwy, wciśnięty”). variant „link”: menu na komputerze.
export default function HideNowRow({ variant }) {
  const on = useSyncExternalStore(subscribe, isDiscreet, () => false);
  if (variant === 'link') {
    return <button type="button" className="linklike" aria-pressed={on} onClick={() => setDiscreet(!on)}>Ukryj nazwy{on ? ' (włączone)' : ''}</button>;
  }
  return (
    <button type="button" className="list-row hide-now" aria-pressed={on} onClick={() => setDiscreet(!on)}>
      <Icon name="shield" /><span className="lr-main">Ukryj nazwy</span><span className="lr-sub" aria-hidden="true">{on ? 'włączone' : 'wyłączone'}</span>
    </button>
  );
}
