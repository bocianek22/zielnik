import LegalDoc from '../components/LegalDoc';
import { legalContact } from '@/lib/legal';

export const metadata = { title: 'Regulamin bety | Zielnik' };
export const dynamic = 'force-dynamic'; // kontakt z zmiennych środowiska, czytany przy żądaniu

export default function Regulamin() {
  const c = legalContact();
  const sections = [
    ['wersja-testowa', 'Wersja testowa', [
      'Zielnik jest w zamkniętej fazie testów (beta). Korzystasz z niego na własną odpowiedzialność, jako jeden z pierwszych testerów.',
      'Nie gwarantujemy ciągłości działania: aplikacja może być niedostępna, zmieniać się albo działać błędnie. Dane mogą zostać utracone, na przykład po awarii, błędzie lub zmianie, której nie da się cofnąć. Zalecamy regularnie pobierać swoje dane (Mój profil, „Pobierz dane”).',
    ]],
    ['charakter', 'Do czego służy aplikacja', [
      'Zielnik to prywatny dziennik pacjentów stosujących medyczną konopię: służy do zapisywania własnych stanów, ocen, zużycia i spostrzeżeń oraz, za Twoją zgodą, do dzielenia się nimi z wybranymi osobami.',
      'Aplikacja nie jest wyrobem medycznym i nie zastępuje lekarza, farmaceuty ani porady medycznej. Nie stawia diagnoz i nie zaleca dawkowania. Informacje o odmianach (także podpowiedzi z internetu) mają charakter pomocniczy i mogą być błędne: o leczeniu decyduje Ty z lekarzem.',
      'Aplikacja nie służy do obrotu ani do reklamy. Zakazane jest oferowanie sprzedaży, wymiany lub przekazywania produktów oraz zachęcanie do ich używania, także w opiniach, notatkach, nazwach grup i profilu.',
    ]],
    ['konto', 'Konto', [
      'Konto może założyć wyłącznie osoba pełnoletnia, która ma kod zaproszenia. Konto jest osobiste: nie udostępniaj go innym osobom ani nie przekazuj hasła. Odpowiadasz za bezpieczeństwo hasła; jeśli podejrzewasz, że ktoś je zna, zmień je i wyloguj inne urządzenia w profilu.',
      'Przy rejestracji akceptujesz regulamin i politykę prywatności oraz osobno wyrażasz wyraźną zgodę na przetwarzanie danych o zdrowiu. Po zmianie dokumentów poprosimy Cię o ponowną akceptację: bez niej nie skorzystasz z aplikacji, ale możesz pobrać swoje dane lub usunąć konto.',
    ]],
    ['tresci', 'Treści wspólne: katalog i propozycje', [
      'Katalog odmian i opisy odmian są wspólne dla wszystkich użytkowników. Gdy proponujesz zmianę lub dodajesz odmianę albo zdjęcie, zasady są następujące:',
      { list: [
        'podawaj tylko informacje, które według Ciebie są prawdziwe, bez reklamy, linków sprzedażowych i danych osób trzecich;',
        'zdjęcia mają być Twoje albo z wolną licencją; nie dodawaj zdjęć osób ani dokumentów;',
        'propozycje zmian wspólnych pól rozpatruje administrator i może je odrzucić bez podania powodu;',
        'dodając treść wspólną, zgadzasz się, że będzie widoczna dla innych użytkowników; Twoje prywatne wpisy (stany, zużycie, zakupy, notatki) pozostają prywatne, chyba że sam zmienisz ich widoczność.',
      ] },
      'Administrator może usunąć treści lub konta naruszające regulamin. Treść naruszającą zasady możesz zgłosić przyciskiem „Zgłoś” przy treści.',
    ]],
    ['zakonczenie', 'Zakończenie bety i zmiany', [
      'Możemy zakończyć betę, zawiesić funkcje lub zmienić regulamin. O zmianie dokumentów dowiesz się z ekranu akceptacji. Przy zakończeniu bety damy Ci możliwość pobrania danych, o ile to technicznie możliwe.',
      'Możesz w każdej chwili przestać korzystać z aplikacji i usunąć konto w zakładce Mój profil. Usunięcie konta usuwa Twoje dane, zgodnie z polityką prywatności.',
    ]],
    ['kontakt', 'Kontakt', [
      `Organizator bety: ${c.name}. Kontakt: ${c.email}.`,
      'Dane osobowe przetwarzamy zgodnie z polityką prywatności, dostępną pod adresem /prywatnosc.',
    ]],
  ];
  return <LegalDoc title="Regulamin bety" sections={sections} other={{ href: '/prywatnosc', label: 'Polityka prywatności' }} />;
}
