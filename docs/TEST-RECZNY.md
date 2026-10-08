# Ręczny test przed wysłaniem zaproszeń

Lista dla właściciela (BETA-C). Automaty (`npm run test:e2e`) sprawdzają Chromium na 390 px i na 1280/1024 px. Tego, czego nie widzą (prawdziwy telefon, Safari, systemowe okna), pilnuje ta lista. Zaznaczaj na bieżąco; każdy błąd zgłoś przyciskiem „Zgłoś uwagę” albo opisz Claude.

Przygotowanie: konto testowe z kodem zaproszenia (nie główne konto), kilka odmian, jedna recepta, jeden wpis objawów. Oczekiwany stan na końcu każdej sekcji: bez błędu na ekranie i bez „białej strony”.

## 1. Android: APK 0.4.0 (z widżetem)
Pełna lista kroków aplikacji i widżetu: `mobile/README.md`, „Checklista testu na telefonie”. Tu tylko to, co musi się udać przed zaproszeniami.
- [ ] Instalacja APK (`mobile/README.md`, „Instalacja APK na telefonie”): jeśli stoi starsza wersja, najpierw ją odinstaluj. Oczekiwane: ikona i nazwa „Zielnik”, zielony ekran startowy.
- [ ] Profil, na dole „Wersja aplikacji: 0.4.0”.
- [ ] Rejestracja z kodem zaproszenia i pierwsze logowanie. Oczekiwane: kreator pierwszego uruchomienia, potem ekran główny.
- [ ] Zamknij aplikację z listy ostatnich i otwórz ponownie. Oczekiwane: nadal zalogowany.
- [ ] „Zużyłem” i „Wykupiłem” z „Cofnij”. Oczekiwane: zapas zmienia się od razu, „Cofnij” przywraca.
- [ ] Tryb samolotowy: „Zużyłem”. Oczekiwane: wpis czeka („czeka: 1”), po włączeniu sieci wysyła się, w Historii jeden wpis.
- [ ] Widżet „Zapas”: dodaj na ekran główny. Oczekiwane: „Starczy na N dni” zgodne z panelem „Dziś”; po wylogowaniu „–”.
- [ ] Blokada aplikacji (profil): włącz, zamknij, otwórz. Oczekiwane: okno odcisku/PIN-u telefonu.
- [ ] Skrót pod ikoną („Zapisz”): otwiera panel „Zużyłem”.
- [ ] Powiadomienia (jeśli Firebase jest skonfigurowany): zgoda i przypomnienie próbne.
- [ ] Raport dla lekarza, „Udostępnij / Zapisz PDF”: systemowe okno druku, PDF z całym raportem.
- [ ] Eksport danych (profil, „Pobierz dane (JSON)”): plik trafia do Pobranych.
- [ ] Klawiatura: w formularzu odmiany i w wyszukiwarce pole jest widoczne nad klawiaturą, dolny pasek znika.

## 2. Android: Chrome i PWA
- [ ] Chrome: otwórz adres aplikacji, zarejestruj konto. Pole nazwy nie wymusza wielkiej litery; menedżer haseł proponuje zapis.
- [ ] Menu, „Zainstaluj aplikację”. Oczekiwane: ikona wśród aplikacji, otwiera się bez paska adresu.
- [ ] Powiadomienia (profil, „Powiadomienia”): zgoda, przypomnienie próbne (jeśli administrator skonfigurował wysyłkę). Oczekiwane: powiadomienie z neutralną treścią.
- [ ] Tryb samolotowy w PWA: „Zużyłem” trafia do kolejki i wysyła się po powrocie sieci.
- [ ] Blokada PIN (profil, „Blokada i bezpieczeństwo”): włącz, wróć do karty po minucie. Oczekiwane: ekran blokady.
- [ ] Raport: „Udostępnij / Zapisz PDF” w Chrome. Oczekiwane: okno drukowania z „Zapisz jako PDF”, bez menu i przycisków na wydruku.
- [ ] Ciemny motyw (system i przełącznik): czytelne teksty, dolne menu nad paskiem gestów.
- [ ] „Większy tekst i przyciski” razem z systemowym rozmiarem czcionki 150%: bez nachodzących na siebie napisów.

## 3. iPhone: Safari (karta)
Minimum: iOS 16.4 (wymaga go Next.js 15 i Web Push); na starszym systemie nie obiecujemy działania.
- [ ] Rejestracja: pole nazwy bez wielkiej litery i autokorekty; kod zaproszenia wklejony z komunikatora działa. Safari proponuje zapis hasła i je podpowiada przy logowaniu.
- [ ] Dotknięcie każdego pola (nazwa, hasło, ilość, notatka, wyszukiwanie). Oczekiwane: ekran nie powiększa się samoczynnie (zoom).
- [ ] Pola dat (nowa recepta, Historia, raport, profil): wygląd jak pozostałe pola, wartość wyrównana do lewej, wybierak działa, wybrana data widoczna w polu.
- [ ] Formularz odmiany (pełny ekran): dotknij pola na dole formularza. Oczekiwane: pole przewija się nad klawiaturę, pasek „Anuluj/Zapisz” nadal na górze.
- [ ] Dolne menu i arkusz „Więcej”: nie wchodzą pod pasek Safari ani pod belkę gestu; po otwarciu klawiatury nic się nie nakłada.
- [ ] Obrót ekranu w poziom i z powrotem: układ wraca, bez poziomego przewijania.
- [ ] Tryb prywatny Safari: zaloguj się, zapisz „Zużyłem”. Oczekiwane: zapis działa (kolejka offline w pamięci karty, bez błędu).
- [ ] Raport: „Udostępnij / Zapisz PDF”. Oczekiwane: okno drukowania lub arkusz udostępniania; w podglądzie PDF cały raport, bez menu.
- [ ] Eksport danych (profil): plik JSON pobiera się lub otwiera w „Pliki”/podglądzie.

## 4. iPhone: PWA (ekran początkowy)
- [ ] Safari, „Udostępnij”, „Do ekranu początkowego”, „Dodaj” (instrukcja: strona Pomoc). Oczekiwane: ikona z liściem, otwiera na pełnym ekranie, bez paska adresu.
- [ ] Zaloguj się w PWA. Zamknij (przesuń w przełączniku) i otwórz. Oczekiwane: nadal zalogowany (ciasteczko 30 dni). Jeśli nie, zanotuj dokładnie kiedy.
- [ ] Zawartość pod notchem i wyspą: nagłówek nie jest przycięty, dolne menu nad belką gestu.
- [ ] Profil, „Powiadomienia”: w PWA widać przycisk włączenia (w karcie Safari tylko wyjaśnienie). Zgoda, powiadomienie próbne lub przypomnienie. Oczekiwane: neutralna treść, dotknięcie otwiera aplikację.
- [ ] Tryb dyskretny (profil, „Tryb dyskretny”): neutralny tytuł karty, rozmyte nazwy, dotknięcie odsłania na 5 s. Pamiętaj: ikona i nazwa na ekranie początkowym się nie zmieniają (opisane w Pomocy).
- [ ] Blokada PIN: włącz, przełącz na inną aplikację na minutę, wróć. Oczekiwane: ekran blokady; zasłona w przełączniku aplikacji bywa niepełna (znane ograniczenie).
- [ ] Tryb samolotowy: „Zużyłem”, wyłącz tryb. Oczekiwane: wpis wysyła się po powrocie do aplikacji (iOS nie ma Background Sync, wysyła strona).
- [ ] Klawiatura w formularzach (odmiana, recepta, objawy, zgłoszenie uwagi): pole widoczne, przyciski dostępne, po schowaniu klawiatury układ wraca.
- [ ] Raport, „Udostępnij / Zapisz PDF”: w PWA okno drukowania bywa pomijane przez iOS; sprawdź, czy da się zapisać lub wysłać PDF (Udostępnij, „Zapisz do Plików”). Jeśli nie, zanotuj i zalecaj wykonanie raportu w Safari.
- [ ] Wylogowanie i ponowne logowanie z menedżera haseł.

## 5. Komputer (Chrome/Firefox/Safari, okno szerokie)
- [ ] Logowanie, ekran główny, lista odmian, szczegóły odmiany: menu u góry (bez dolnego), treść wyśrodkowana, bez poziomego przewijania.
- [ ] Historia: tabele czytelne, „Popraw” zakupu działa.
- [ ] Raport dla lekarza: „Udostępnij / Zapisz PDF”, w podglądzie wydruku: format A4, bez menu, przycisków i filtrów, czarny tekst na białym tle, nazwy odmian widoczne także w trybie dyskretnym, tabele nie są ucięte.
- [ ] Eksport: profil, „Pobierz dane (JSON)” i „Pobierz ze zdjęciami”. Oczekiwane: pobiera się plik `.json`; otwórz go i sprawdź, że są Twoje wpisy. „Moje odmiany (CSV)” i CSV dziennika otwierają się w Excelu z polskimi znakami.
- [ ] Panel admina (konto Bocian): zakładka „Gotowość” (wszystko zielone poza tym, co świadomie odłożone), „Zgłoszenia” (uwagi z telefonów widoczne, zmiana statusu działa, autor widzi nowy status), „Konta” (kody zaproszeń: utwórz kod, skopiuj link).
- [ ] Okno zwężone do ok. 700 px: przełączenie na układ telefonu bez ucięć.

## 6. Na koniec, przed wysłaniem zaproszeń
- [ ] Kod zaproszenia z panelu admina działa na czystym koncie, a po wyczerpaniu limitu zostaje odrzucony.
- [ ] „Zgłoś uwagę” z telefonu dociera do panelu admina.
- [ ] Wiadomość z `docs/BETA-ZAPROSZENIE.md` ma uzupełniony adres aplikacji, link do grupy i kontakt.
- [ ] Zmienne produkcyjne z `docs/HANDOFF.md` (sekcja 6) ustawione, „Gotowość” bez czerwonych pozycji.

## Wyniki przeglądu kodu pod Safari i iOS (8.10)
WebKit nie jest dostępny w kontenerze testowym, więc to analiza kodu, a nie test. Poniższe pozycje trzeba potwierdzić na iPhonie (sekcje 3 i 4).

Sprawdzone, bez zmian:
- **IndexedDB** (`lib/offline-client.js`): błąd lub brak otwarcia bazy (tryb prywatny, zablokowane dane witryny) kończy się zapasem w pamięci karty; zapis online nie przechodzi przez kolejkę, gdy sieć działa i kolejka jest pusta. Jeśli otwarcie wisi, zapis czeka najwyżej 2 s i idzie bez kolejki. Ryzyko: w trybie prywatnym wpisy z kolejki giną po zamknięciu karty (opisane jako zapas w pamięci).
- **Web Push** (`app/profil/PushSettings.js`): w karcie Safari na iPhonie pokazuje się wyjaśnienie („tylko w aplikacji dodanej do ekranu początkowego, iOS 16.4”), w PWA od 16.4 przycisk włączenia. Zgodę trzeba wywołać z dotknięcia (tak jest: przycisk).
- **`navigator.share`, schowek, `print()`** w raporcie, zaproszeniach i profilu: zawsze z wykrywaniem i zapasem (schowek, link w komunikacie). `window.print()` w PWA na iOS bywa ograniczone (sekcja 4).
- **`inert`** (iOS 15.5+) tylko w `ConsentGate` i `useFocusTrap`; brak `<dialog>`; `visualViewport` (SearchSuggest) z zapasem na `window.innerHeight`, `navigator.locks` opcjonalne.
- **Wersje**: `Array.prototype.at` (iOS 15.4), `Object.hasOwn` (15.4), `structuredClone` (15.4, tylko zapas kolejki w pamięci), `replaceAll` (13.4), `crypto.randomUUID` (15.4; w `lib/ids.js` z zapasem poza HTTPS), `:has()` (15.4, jedna reguła w wyszukiwarce), `subgrid` (16, na starszych tylko niewyrównane wiersze ocen), `color-mix()` (16.2; na starszych plakietki bez tła), Web Push (16.4). Next.js 15 i tak wymaga Safari 16.4+. Brak polyfilli i brak potrzeby.
- **Autouzupełnianie haseł**: `/login` (`username`, `current-password`), `/register` (`username`, `new-password`), `/nowe-haslo` i `/change-password` (`new-password`, `current-password`) mają poprawne atrybuty.
- **Rozmiar pól**: na urządzeniach dotykowych (`pointer: coarse`) wszystkie `input`, `select`, `textarea` mają co najmniej 16 px (`globals.css`), a `.input` dziedziczy 1rem z `body`, więc Safari nie powiększa strony przy fokusie. Zawsze sprawdź też tryb „Większy tekst”.
- **Notch i belka gestu**: `viewport-fit=cover` jest włączone, a dolne menu, arkusz, FAB, formularz odmiany, podgląd zdjęcia i okno „Co nowego” używają `env(safe-area-inset-*)`.

Poprawione w tym przeglądzie:
- Pola nazwy użytkownika i kodu zaproszenia (login, rejestracja, odzyskiwanie hasła): `autocapitalize="none"`, `autocorrect="off"`, bez sprawdzania pisowni (iOS wpisywał wielką literę i autokorektę).
- Wysokości w `vh` (arkusz „Więcej”, okno „Co nowego”, lista katalogu, ekran stanu) mają zapas w `dvh`: na iOS `vh` liczy się z paskiem Safari i okna mogły wychodzić poza widoczny ekran.
- `input[type=date|time]`: `min-width: 0` i wyrównanie do lewej (Safari wyśrodkowuje wartość i potrafi rozpychać rodzica we flexie).
- Komunikat o instalacji w ustawieniach powiadomień: pełna nazwa „Do ekranu początkowego” (była skrócona).

Znane ryzyka do sprawdzenia na iPhonie (nie poprawiane bez urządzenia):
- Formularz odmiany to `position: fixed; inset: 0` z własnym przewijaniem. Klawiatura ekranowa iOS przykrywa dół widoku, a nie zmniejsza go: ostatnie pola mogą wymagać przewinięcia. Jeśli tak, dodać dolny odstęp zależny od `visualViewport` (jak w `SearchSuggest.js`).
- `body { min-height: 100vh }` na iOS jest wyższe od widocznego ekranu przy krótkiej treści: możliwa pusta przewijana przestrzeń na krótkich stronach.
- Stały dolny pasek i arkusze są `fixed`: przy otwartej klawiaturze w Safari mogą „odjechać” albo zawisnąć nad klawiaturą (klasa `kbd-open` jest tylko w aplikacji Android).
- Ciasteczko sesji w PWA: iOS trzyma PWA w osobnym magazynie niż Safari, więc po dodaniu do ekranu początkowego trzeba zalogować się ponownie (to oczekiwane, zaznaczone w sekcji 4).
- Zasłona blokady w przełączniku aplikacji bywa niepełna (`docs/HANDOFF.md`, 0.38.0).
- Nazwa i ikona PWA w trybie dyskretnym pozostają „Zielnik” z liściem: `manifest` jest jeden. Opisane w Pomocy, do ewentualnej decyzji właściciela (alternatywny manifest).
- Brak `apple-mobile-web-app-*` w nagłówku: iOS bierze nazwę i tryb pełnoekranowy z manifestu (od 16.4 działa); starsze wersje otworzą stronę w karcie.
