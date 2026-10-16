import { pharmacySearchUrl } from '@/lib/pharmacies';
import Icon from './Icon';

// Odnośnik do wyszukiwarki aptek. Tekst jest zawsze neutralny (bez nazwy odmiany), więc w trybie
// dyskretnym niczego nie zdradza; w aplikacji natywnej NativeShell otwiera go w przeglądarce systemowej.
// card: osobny wiersz-karta (szczegóły odmiany, między zwijanymi sekcjami), bez tego zwykły link w karcie (katalog).
export default function PharmacyLink({ url, registeredName, producer, name, card = false }) {
  const href = pharmacySearchUrl({ url, registeredName, producer, name });
  if (card) {
    return (
      <a className="card list-row pharmacy-row" href={href} target="_blank" rel="noopener noreferrer">
        <span className="ic-dot sm" data-cat="rx"><Icon name="search" size={18} /></span>
        <span className="lr-main">Sprawdź dostępność w aptekach<span className="lr-sub">Serwis zewnętrzny gdziepolek.pl. Zielnik nie odpowiada za jego dane.</span></span>
        <Icon name="chevronRight" size={20} className="lr-chev" />
      </a>
    );
  }
  return (
    <p className="pharmacy-link">
      <a href={href} target="_blank" rel="noopener noreferrer">Sprawdź dostępność w aptekach</a>
      <span className="muted small">Serwis zewnętrzny gdziepolek.pl. Zielnik nie odpowiada za jego dane.</span>
    </p>
  );
}
