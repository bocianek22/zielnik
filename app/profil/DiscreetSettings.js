'use client';
import Icon from '../components/Icon';
import { useState, useSyncExternalStore } from 'react';
import { isDiscreet, setDiscreet, discreetAuto, setDiscreetAuto } from '@/lib/discreet';

const subscribe = (cb) => { window.addEventListener('zielnik:discreet', cb); return () => window.removeEventListener('zielnik:discreet', cb); };

// Tryb dyskretny dla tego urządzenia: neutralny tytuł karty i rozmyte nazwy odmian, producentów i terpenów
export default function DiscreetSettings() {
  const on = useSyncExternalStore(subscribe, isDiscreet, () => false);
  const stored = useSyncExternalStore(subscribe, discreetAuto, () => false);
  const [auto, setAuto] = useState(null); // null = jak zapisane na urządzeniu
  function toggle(e) { setDiscreet(e.target.checked); }
  function toggleAuto(e) { setAuto(e.target.checked); setDiscreetAuto(e.target.checked); }
  return (
    <section className="card stack">
      <div className="sec-head switch-row">
        <div className="ic-dot sm"><Icon name="moon" size={20} /></div>
        <h2 id="discreet-h">Tryb dyskretny</h2>
        <input type="checkbox" className="switch" role="switch" checked={on} onChange={toggle} aria-labelledby="discreet-h" aria-describedby="discreet-d" />
      </div>
      <p id="discreet-d" className="muted">Dla osób, które nie chcą, żeby ktoś zaglądający w telefon od razu widział, czego dotyczy aplikacja. Ustawienie działa tylko na tym urządzeniu.</p>
      <ul className="muted small">
        <li>Karta przeglądarki nazywa się wtedy „Notatnik”.</li>
        <li>Nazwy odmian, producentów i terpenów są rozmyte. Dotknij nazwy, żeby pokazać ją na 5 sekund.</li>
        <li>Szybkie przełączanie: „Ukryj nazwy teraz” w menu „Więcej” albo dwa szybkie dotknięcia logo w nagłówku.</li>
        <li>Ikona i nazwa na ekranie głównym telefonu pozostają bez zmian (ustawia je system, nie da się ich zmienić dla jednego użytkownika). Powiadomienia i tak mają neutralną treść.</li>
      </ul>
      <label className="switch-row">
        <span>Włączaj sam po wyjściu z aplikacji (przełączenie na inną aplikację, zablokowanie ekranu)</span>
        <input type="checkbox" className="switch" role="switch" checked={auto ?? stored} onChange={toggleAuto} />
      </label>
    </section>
  );
}
