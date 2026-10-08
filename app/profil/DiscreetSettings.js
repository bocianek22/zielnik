'use client';
import { useEffect, useState } from 'react';
import { isDiscreet, setDiscreet } from '@/lib/discreet';

// Tryb dyskretny dla tego urządzenia: neutralny tytuł karty i rozmyte nazwy odmian, producentów i terpenów
export default function DiscreetSettings() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(isDiscreet()); }, []);
  function toggle(e) { setOn(e.target.checked); setDiscreet(e.target.checked); }
  return (
    <section className="card stack">
      <div className="switch-row"><h2 id="discreet-h">Tryb dyskretny</h2>
        <input type="checkbox" className="switch" role="switch" checked={on} onChange={toggle} aria-labelledby="discreet-h" aria-describedby="discreet-d" /></div>
      <p id="discreet-d" className="muted">Dla osób, które nie chcą, żeby ktoś zaglądający w telefon od razu widział, czego dotyczy aplikacja. Ustawienie działa tylko na tym urządzeniu.</p>
      <ul className="muted small">
        <li>Karta przeglądarki nazywa się wtedy „Notatnik”.</li>
        <li>Nazwy odmian, producentów i terpenów są rozmyte. Dotknij nazwy, żeby pokazać ją na 5 sekund.</li>
        <li>Szybkie przełączanie: dwa szybkie dotknięcia logo w nagłówku.</li>
        <li>Ikona i nazwa na ekranie głównym telefonu pozostają bez zmian (ustawia je system, nie da się ich zmienić dla jednego użytkownika). Powiadomienia i tak mają neutralną treść.</li>
      </ul>
    </section>
  );
}
