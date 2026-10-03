import { pharmacySearchUrl } from '@/lib/pharmacies';

// Odnośnik do wyszukiwarki aptek. Tekst jest zawsze neutralny (bez nazwy odmiany), więc w trybie
// dyskretnym niczego nie zdradza; w aplikacji natywnej NativeShell otwiera go w przeglądarce systemowej.
export default function PharmacyLink({ url, registeredName, producer, name }) {
  return (
    <p className="pharmacy-link">
      <a href={pharmacySearchUrl({ url, registeredName, producer, name })} target="_blank" rel="noopener noreferrer">Sprawdź dostępność w aptekach</a>
      <span className="muted small">Serwis zewnętrzny gdziepolek.pl. Zielnik nie odpowiada za jego dane.</span>
    </p>
  );
}
