import { cookies } from 'next/headers';
import LegalDoc from '../components/LegalDoc';
import { legalContact } from '@/lib/legal';
import { parseKey } from '@/lib/backup-pack';

// Tryb dyskretny (ciasteczko): tytuł karty bez nazwy aplikacji
export async function generateMetadata() {
  const discreet = (await cookies()).get('zielnik_discreet')?.value === '1';
  return { title: discreet ? 'Polityka prywatności' : 'Polityka prywatności | Zielnik' };
}
export const dynamic = 'force-dynamic'; // kontakt z zmiennych środowiska, czytany przy żądaniu

// Treść wynika z przeglądu kodu: docs/BEZPIECZENSTWO.md, sekcja „Podmioty zewnętrzne”. „Do potwierdzenia” = brak danych
// w repozytorium (region, umowy), uzupełnia właściciel. Po zmianie treści podnieś LEGAL_VERSION w lib/legal.js.
export default function Prywatnosc() {
  const c = legalContact();
  // stan szyfrowania kopii czytany z konfiguracji (tylko tak/nie, bez wartości klucza)
  let encrypted = false;
  try { encrypted = !!parseKey(process.env.BACKUP_ENCRYPTION_KEY); } catch { /* klucz nieprawidłowy: kopie nie powstaną, tekst nie obiecuje szyfrowania */ }
  const sections = [
    ['administrator', 'Kto jest administratorem', [
      `Administratorem Twoich danych jest: ${c.name}. Kontakt w sprawach danych osobowych: ${c.email}.`,
      'Zielnik jest w zamkniętej becie. Ta polityka opisuje, jakie dane zbieramy, po co, komu je powierzamy i jakie masz prawa. Piszemy ją prostym językiem; jeśli coś jest niejasne, napisz do nas.',
    ]],
    ['dane', 'Jakie dane przetwarzamy', [
      { list: [
        'konto: nazwa użytkownika, hasło (przechowujemy tylko jego skrót), opcjonalnie opis profilu, awatar i linki; opcjonalnie adres e-mail (do odzyskiwania hasła), po Twojej zgodzie;',
        'dane o zdrowiu, które sam wpisujesz: odmiany i ich oceny, stany i objawy, zużycie, zakupy, recepty, notatki dla lekarza, testy ze zdjęciami, przypomnienia. Informacja o stosowaniu medycznej konopi jest daną dotyczącą zdrowia (szczególna kategoria, art. 9 RODO);',
        'znajomi, grupy i ustawienia widoczności;',
        'urządzenia, na których jesteś zalogowany: przybliżony opis (np. „Chrome, Android”), kraj i czas ostatniego użycia. Nie zapisujemy adresu IP w opisie urządzenia;',
        'dane techniczne: dziennik błędów serwera (źródło, adres strony bez parametrów, krótki komunikat), liczniki ograniczające liczbę prób logowania i rejestracji (zawierają adres IP lub nazwę konta, wygasają po ok. dobie);',
        'adres subskrypcji powiadomień push lub token urządzenia, jeśli włączysz przypomnienia;',
        'zgłoszenia uwag od testerów (gdy z nich korzystasz): kategoria, opis, wersja aplikacji, ekran, platforma. Prosimy, by nie wpisywać w nich danych zdrowotnych.',
      ] },
    ]],
    ['cele', 'Po co i na jakiej podstawie', [
      { list: [
        'prowadzenie konta i dziennika, czyli świadczenie usługi, której używasz: art. 6 ust. 1 lit. b RODO (umowa, czyli regulamin);',
        'dane o zdrowiu: wyłącznie na podstawie Twojej wyraźnej zgody, art. 9 ust. 2 lit. a RODO w związku z art. 6 ust. 1 lit. a. Zgodę wyrażasz przy rejestracji (osobno od akceptacji regulaminu) i możesz ją cofnąć w każdej chwili, usuwając konto. Cofnięcie nie wpływa na zgodność z prawem przetwarzania sprzed cofnięcia. Bez tej zgody nie możemy prowadzić dziennika;',
        'bezpieczeństwo, ochrona przed nadużyciami, naprawa błędów i kopie zapasowe: prawnie uzasadniony interes administratora, art. 6 ust. 1 lit. f;',
        'adres e-mail i powiadomienia push: Twoja zgoda, art. 6 ust. 1 lit. a (wyrażana przy dodaniu adresu lub włączeniu powiadomień);',
        'zgłoszenia uwag testerów: prawnie uzasadniony interes, czyli ulepszanie aplikacji, art. 6 ust. 1 lit. f.',
      ] },
      'Nie sprzedajemy danych, nie używamy ich do reklam i nie profilujemy Cię.',
    ]],
    ['odbiorcy', 'Komu powierzamy dane', [
      'Korzystamy z podmiotów, które przetwarzają dane w naszym imieniu. Poniżej wiemy, co do nich trafia.',
      { list: [
        'Vercel (hosting aplikacji i prywatny magazyn Vercel Blob na kopie zapasowe i część zdjęć): przez serwery przechodzą wszystkie dane aplikacji, w tym dane o zdrowiu. Region funkcji: do potwierdzenia (ustawienie domyślne to USA). Magazyn kopii: Frankfurt (UE), do potwierdzenia;',
        'Neon (baza danych PostgreSQL): przechowuje wszystkie dane konta i dziennika. Region: do potwierdzenia;',
        'Anthropic (usługa AI dla funkcji „Uzupełnij z internetu”): dostaje wyłącznie nazwę odmiany i producenta, bez Twojej nazwy konta i bez danych o zdrowiu. Administrator używa jej też do odczytu zdjęć listy produktów z apteki (bez danych użytkowników). Siedziba w USA;',
        'Resend (wysyłka e-maili): tylko jeśli podasz adres e-mail. Dostaje adres, nazwę konta i neutralną treść (bez wzmianek o konopiach);',
        'Google Firebase Cloud Messaging i usługi push przeglądarek: przypomnienia w aplikacji na Androida i w przeglądarce. Dostają token lub adres urządzenia i krótką, domyślnie neutralną treść („Masz N przypomnień”);',
        'usługa powiadomień dla administratora (np. Discord lub Slack): dostaje wyłącznie informacje techniczne o błędach (rodzaj, zamaskowana ścieżka, liczby), bez danych użytkowników.',
      ] },
      'Dostęp do danych ma też administrator aplikacji (w zakresie potrzebnym do obsługi: panel administratora, zgłoszenia, dziennik błędów, kopie zapasowe). Nowe wpisy (oceny, notatki, testy) są domyślnie prywatne, a widoczność każdego wpisu ustawiasz sam; stany posiadania, ilości, zużycie i zakupy są zawsze prywatne.',
      'Wyjątek stanowi średnia cena za gram odmiany: aplikacja liczy ją z cen wpisanych przez wszystkich użytkowników, niezależnie od widoczności wpisów, ale pokazuje ją dopiero od 3 zgłoszeń ceny i tylko jako jedną liczbę, bez informacji, kto ją podał.',
    ]],
    ['poza-eog', 'Przekazywanie danych poza Europejski Obszar Gospodarczy', [
      'Część podmiotów (Anthropic, Google, a zależnie od regionu także Vercel, Neon i Resend) ma siedzibę lub serwery w USA. Przekazanie odbywa się na podstawie mechanizmu przewidzianego w RODO (decyzja o odpowiednim stopniu ochrony lub standardowe klauzule umowne): do potwierdzenia, dla każdego podmiotu osobno. Dane o zdrowiu nie trafiają do Anthropic ani do Resend; ich przetwarzanie w USA może dotyczyć funkcji hostingu, jeśli region nie zostanie ustawiony w UE (do potwierdzenia).',
    ]],
    ['okresy', 'Jak długo przechowujemy dane', [
      { list: [
        'konto i wpisy: do czasu usunięcia konta przez Ciebie (Mój profil, „Usuń konto”); usunięcie kasuje dane z bazy i zdjęcia testów z magazynu;',
        'odmiany i zdjęcia odmian dodane do wspólnego katalogu: usunięcie konta ich NIE kasuje. Zostają w katalogu dla wszystkich użytkowników jako anonimowe (aplikacja zrywa ich powiązanie z Twoim kontem). Jeśli chcesz usunąć taką treść, napisz do nas przed usunięciem konta (kontakt wyżej);',
        'kopie zapasowe: do 12 tygodni (84 dni), potem są usuwane automatycznie. W tym czasie dane usuniętego konta mogą jeszcze znajdować się w kopii; nie używamy kopii do niczego poza odtworzeniem serwisu po awarii. Kopie nie zawierają haseł, awatarów ani zdjęć odmian;',
        'dziennik błędów: ostatnie 500 wpisów, starsze są usuwane automatycznie (limit liczby wpisów, nie czasu);',
        'sesje logowania: do 30 dni od zalogowania, wygasłe usuwane; możesz wylogować urządzenia w profilu;',
        'liczniki prób logowania i rejestracji: ok. 1 doba od wygaśnięcia okna;',
        'zgłoszenia uwag testerów: usuwane razem z kontem;',
        'dane w usługach zewnętrznych (Resend, Firebase, usługa alertów): zgodnie z ich zasadami, do potwierdzenia.',
      ] },
    ]],
    ['prawa', 'Twoje prawa', [
      { list: [
        'dostęp i kopia danych: Mój profil, „Pobierz dane” (JSON, opcjonalnie ze zdjęciami) i eksport CSV;',
        'sprostowanie: edytujesz swoje dane w aplikacji;',
        'usunięcie danych i cofnięcie zgody: „Usuń konto” w profilu. Konto administratora aplikacji nie usuwa się z profilu: jego właściciel może cofnąć zgodę, kontaktując się z administratorem danych (kontakt wyżej);',
        'ograniczenie przetwarzania, sprzeciw i przeniesienie danych: napisz do nas (kontakt wyżej); eksport JSON służy też do przeniesienia danych;',
        'skarga do organu nadzorczego: Prezes Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl.',
      ] },
      'Podanie danych jest dobrowolne, ale bez nazwy użytkownika, hasła i zgody na przetwarzanie danych o zdrowiu nie możemy prowadzić konta.',
    ]],
    ['bezpieczenstwo', 'Jak chronimy dane', [
      'Połączenie jest szyfrowane (HTTPS). Hasła przechowujemy tylko w postaci skrótu. Sesja jest w ciasteczku niedostępnym dla skryptów, a urządzenia możesz wylogować. Z przesyłanych zdjęć usuwamy metadane (np. lokalizację). Nowe wpisy są domyślnie prywatne. Aplikacja ma ograniczenia prób logowania, nagłówki bezpieczeństwa i opcjonalną blokadę PIN-em. Kopie zapasowe są przechowywane w prywatnym magazynie' + (encrypted ? ' i szyfrowane.' : '; szyfrowanie kopii nie jest obecnie włączone.') + ' Żaden system nie jest w pełni bezpieczny: o naruszeniu ochrony danych powiadomimy zgodnie z prawem.',
    ]],
    ['dyskretny', 'Tryb dyskretny', [
      'Tryb dyskretny (Mój profil, ustawienie działa tylko na danym urządzeniu) zmienia nazwę karty przeglądarki na „Notatnik” i rozmywa nazwy odmian, producentów i terpenów na ekranie; e-maile mają neutralną treść. To ochrona przed przypadkowym podejrzeniem na ekranie telefonu, a nie zmiana tego, jakie dane przechowujemy. Ikona i nazwa aplikacji na ekranie głównym telefonu oraz tytuł powiadomień push pozostają bez zmian, a treść przypomnień jest neutralna.',
    ]],
    ['wersja', 'Wersja dokumentu', [
      'Zmiany tej polityki ogłaszamy ekranem ponownej akceptacji. Przy Twoim koncie zapisujemy historię zgód (data, wersja dokumentów i zakres każdej akceptacji); widzisz ją w eksporcie danych. Aplikacja nie publikuje poprzednich wersji tekstów, ale zachowujemy je w historii kodu aplikacji i na Twoją prośbę udostępnimy treść wersji, którą zaakceptowałeś (kontakt wyżej). Wersja dokumentu zmienia się także wtedy, gdy zmienią się dane administratora.',
    ]],
  ];
  return <LegalDoc title="Polityka prywatności" sections={sections} other={{ href: '/regulamin', label: 'Regulamin bety' }} />;
}
