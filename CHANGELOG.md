# Historia zmian

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersjonowanie zgodne z [SemVer](https://semver.org/lang/pl/) (`MAJOR.MINOR.PATCH`).
Do wersji 1.0.0 (publiczny start) każda nowa funkcja podnosi `MINOR`, a poprawka błędu `PATCH`.

Wersje 0.1.0 do 0.14.0 zostały odtworzone z historii prac (wgrywanych paczkami przez GitHub). Nie mają znaczników `git`.
Pierwsze wydanie ze znacznikiem to **v0.15.0**. Kolejne wydania tworzy workflow „Wydanie” (patrz `CONTRIBUTING.md`).

## [Unreleased]
### Dodano
- Powiadomienia push do aplikacji natywnej przez Firebase Cloud Messaging (HTTP v1): `lib/fcm.js` (token OAuth z konta usługi w `FIREBASE_SERVICE_ACCOUNT`, podpis RS256, cache tokenu). Przypomnienia i powiadomienie testowe trafiają też na tokeny FCM, z tą samą neutralną treścią co Web Push. Token z `UNREGISTERED`/404 jest usuwany. Bez zmiennej wysyłka FCM jest wyłączona.
### Zmieniono
- Cron przypomnień i test działają, gdy skonfigurowany jest Web Push albo FCM (wcześniej tylko VAPID); `/api/push/config` zwraca też `fcm` i `any`. W profilu w aplikacji przycisk testu pojawia się, gdy serwer ma Firebase.

## [0.31.0] - 2026-10
### Dodano
- ESLint 9 (`npm run lint`, `eslint.config.mjs`) z regułami `no-undef`, `no-unused-vars` i reguł hooków Reacta, uruchamiany w CI po `npm run check`; reguły React Compiler działają jako ostrzeżenia.
- System projektowy (`docs/DESIGN.md`): tokeny kolorów, typografii, odstępów i promieni w `app/globals.css` (jasny i ciemny motyw), jeden zestaw ikon SVG (`Icon.js`), style podzielone na pliki obszarów w `app/styles/`.
- Aplikacja Android wygląda natywnie: bez pasków przewijania i efektu przeciągnięcia przeglądarki, haptyka, odświeżanie przeciągnięciem, przejścia między ekranami, ekran startowy i ikona, ekran offline, obsługa klawiatury, ciasteczko sesji zapisywane przy zejściu do tła.
- Wspólny parser liczb (`app/components/num.js`) i format daty (`lib/date.js`) z testami.
### Zmieniono
- Nowy wygląd wszystkich ekranów: nawigacja, lista i karta odmiany, szczegóły, profil jako ustawienia, logowanie i rejestracja, katalog i wyszukiwanie, rankingi i koło, historia, raport, dziennik objawów, recepty, znajomi, grupy, profil publiczny, wiedza, premium, panel admina (zakładki, listy zamiast tabel), ekrany błędu i 404.
- Na telefonie „Dodaj odmianę” jest pod przyciskiem „+”, a „Wyloguj” w menu „Więcej”; zwinięta karta pokazuje szybkie akcje zamiast pola zużycia.
- Pola ilości, THC, CBD i cen przyjmują przecinek („0,5”) i pokazują klawiaturę dziesiętną; błędna liczba daje komunikat zamiast cichego zera.
- Cele dotykowe co najmniej 44 px, karta odmiany mieści się na ekranie 320 px, przycisk „+” nie zasłania końca strony szczegółów.
- Tryb dyskretny obejmuje też profil publiczny, grupy, raport (wydruk pokazuje nazwy), historię zmian odmiany i komunikaty katalogu.
### Naprawiono
- Przełączenie zakładki w panelu admina kasowało komunikat z hasłem tymczasowym po resecie konta.
- Aplikacja Android: przytrzymanie pola tekstowego nie pozwalało wkleić tekstu; nawigacja po kotwicy (#) zamrażała ekran na chwilę; podwójna wibracja przełączników; przerwane przeciąganie odświeżania mogło przeładować stronę.
- Build APK przerywał niepoprawny komentarz w `colors.xml`.

## [0.30.0] - 2026-10
### Dodano
- Szybkie akcje „Zużyłem” i „Wykupiłem” na wierzchu karty odmiany, z panelem gramów i szybkimi wartościami (UX-3).
- Przypomnienia push (PAC-3): kończąca się recepta i kończący się zapas, jedno zbiorcze powiadomienie dziennie (ok. 9:00), domyślnie z neutralną treścią bez nazw odmian; ustawienia i powiadomienie testowe w profilu. Wymaga kluczy VAPID w Vercel.
- Tryb dyskretny (PRA-7), osobno dla każdego urządzenia: tytuł „Notatnik”, rozmyte nazwy odmian odsłaniane dotknięciem, koło fortuny bez nazw; szybkie przełączanie dwuklikiem logo.
- Historia zmian odmian z przywracaniem przez admina (KAT-1, krok 1). Nazwa edytującego jest widoczna zgodnie z widocznością jego profilu.
- Kopie zapasowe poza bazą w prywatnym Vercel Blob (PLA-7): gzip, opcjonalne szyfrowanie AES-256-GCM (`BACKUP_ENCRYPTION_KEY`), retencja 12 tygodni, automatycznie wszystkie tabele z danymi; skrypt `scripts/backup-decrypt.js`.
- Szkielet aplikacji natywnej (MOB-16, `mobile/`): Capacitor 8 dla Androida (najpierw) i iOS, ładuje produkcyjną aplikację; w aplikacji ukryte ceny aptek, blokada biometrią/PIN-em, przycisk wstecz, linki zewnętrzne w przeglądarce, rejestracja tokenu FCM. APK budowany w GitHub Actions („Aplikacja Android”). Instrukcja: `mobile/README.md`.
- „Znane urządzenie” przy logowaniu (DT-14): atak z wielu adresów nie zablokuje logowania właściciela na jego urządzeniu.
### Zmieniono
- Lżejsza lista odmian (MOB-10, DT-4): nowe odmiany i konta nie tworzą już pustych wpisów dla wszystkich użytkowników; strona odmiany pobiera wpisy tylko tej odmiany; „znajomi znajomych” w `can_see` przez indeksy (wyniki identyczne jak wcześniej).
- Zdjęcie odmiany może podmienić lub usunąć tylko osoba, która je dodała, autor odmiany albo admin; dodać brakujące może każdy.
- Limit prób przy usuwaniu konta, górne granice długości haseł, import katalogu przez `requireAdmin`.
### Naprawiono
- Autozapis pól karty nie nadpisuje już stanu zmienionego w międzyczasie szybkim zużyciem lub wykupem.
- Identyfikatory spoza zakresu w adresach stron (odmiana, grupa, katalog, porównanie) dają 404 zamiast błędu serwera.
- Cron przypomnień: limit czasu wysyłki i błąd jednego użytkownika nie przerywa wysyłki pozostałym.
### Uwaga przy wycofaniu wdrożenia
- Wersje < 0.30.0 zakładają wpisy `user_strain` dla wszystkich par. Przed ewentualnym wycofaniem wykonaj w bazie: `INSERT INTO user_strain (strain_id, user_id) SELECT s.id, u.id FROM strains s CROSS JOIN users u ON CONFLICT DO NOTHING`.

## [0.29.0] - 2026-10
### Dodano
- „Wyloguj ze wszystkich urządzeń” na stronie Mój profil (`POST /api/auth/logout` z `{ all: true }`).
### Zmieniono
- Szybszy start aplikacji (DT-11): migracje bazy (`ensureDb`, ok. 85 zapytań) wykonują się tylko po zmianie schematu, rozpoznanej po sumie kontrolnej w nowej tabeli `schema_meta`. Zwykły zimny start funkcji to 1-2 zapytania. Pierwsze uruchomienie po wdrożeniu wykona pełną migrację jeden raz.
- Sesje (DT-13): zmiana hasła, reset hasła przez admina, „wyloguj wszędzie” i nadpisanie hasła admina ze zmiennej środowiskowej unieważniają wcześniejsze sesje (nowa kolumna `users.session_version`). Dotychczasowe sesje działają dalej po wdrożeniu.
- Limit prób logowania (DT-14): ścisły limit liczony dla pary adres IP + nazwa (8 / 15 min), więc obca osoba z innego adresu nie zablokuje już właściciela konta; dodatkowo 50 prób na godzinę na nazwę i bez zmian 30 / 15 min na adres.
- Wszystkie trasy admina sprawdzają uprawnienia jedną funkcją `requireAdmin()`; admin z wymuszoną zmianą hasła nie korzysta z API admina, dopóki go nie zmieni.
- Zmiana hasła: limit 10 prób / 15 min, maksymalnie 100 znaków.
- Nagłówki bezpieczeństwa (PLA-8): `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` i `frame-ancestors`, HSTS (bez `includeSubDomains` do czasu własnej domeny), `Permissions-Policy`.
- Jedna lista pozycji menu dla górnego i dolnego paska oraz arkusza „Więcej” (MOB-17). Na komputerze „Wiedza” jest teraz przed „Premium i wsparcie”, jak na telefonie.
- Strona Premium: wygasły plan pokazuje się jako „Darmowy (Premium wygasło …)” zamiast „Premium (ważny do <data z przeszłości>)”.
### Naprawiono
- Edycja producenta, THC lub CBD odmiany zerowała wszystkim „do wykupienia” w tej puli (DT-12). Wartości przechodzą teraz na nową pulę (przy kolizji zostaje większa, bo to ta sama recepta); gdy stara pula jest nadal używana przez inną odmianę, nowa dostaje kopię.
- Ochrona przed usunięciem odmiany obejmuje też zakupy i „do wykupienia” innych osób; sprawdzenie i usunięcie to jedno zapytanie.
- Równoległa edycja tej samej odmiany mogła zostawić osieroconą pulę „do wykupienia” (edycja w transakcji z blokadą wiersza, `sql.transaction`).
- Zużycie/wykup odmiany usuniętej w międzyczasie zwraca 404 zamiast 500; wylogowanie odporne na błędy i puste ciało żądania.
### Dla programistów
- Testy z bazą: `tests/db/schema.test.js`, `pools.test.js`, `security.test.js` (razem 24 przypadki). Shim Neon w testach obsługuje leniwe zapytania i `sql.transaction`.
- `SCHEMA_REV` w `lib/db.js`: podnieś ręcznie przy zmianie samej logiki JS w `init()`, której suma kontrolna SQL nie wykryje.
- Niezależny przegląd całej gałęzi przez agenta reviewer: bez błędów blokujących; poprawki powyżej. Definicje subagentów w `.claude/agents/` i `CLAUDE.md`.

## [0.28.2] - 2026-10
### Naprawiono
- Zużycie i wykup: dwa szybkie zapisy naraz (np. podwójne dotknięcie przycisku) nadpisywały się i stan po nich był błędny (8 równoczesnych zapisów zużycia po 1 g z 10 g zostawiało 8 g zamiast 2 g). Odejmowanie i dodawanie odbywa się teraz w jednym zapytaniu SQL.
- Usunięcie odmiany przez jej twórcę kasowało kaskadowo oceny, opinie, testy i dziennik zużycia **innych osób**. Twórca może teraz usunąć tylko odmianę, której nikt inny nie używa (w przeciwnym razie komunikat i kod 409); admin bez zmian.
- Błędny identyfikator w adresie (np. `/api/strains/abc`) kończył się błędem SQL 500 i wpisem w dzienniku błędów zamiast odpowiedzi 404 (nowa funkcja `intId` w `lib/guard.js`, użyta we wszystkich trasach z `[id]`/`[tid]`).
- „Wykupione w tym miesiącu” liczyło początek miesiąca w UTC zamiast czasu polskiego (zakupy z 1. dnia miesiąca przed 1:00/2:00 trafiały do poprzedniego miesiąca).
### Dodano
- Testy integracyjne z prawdziwym PostgreSQL (`npm run test:db`, katalog `tests/db/`): schemat `ensureDb` (idempotentność), widoczność `can_see` (tylko ja / znajomi / znajomi znajomych / blokada), równoległe zapisy, ochrona przed usunięciem cudzych danych, trasy API bez błędów SQL. Realizuje część PLA-1.
- CI w GitHub Actions (`.github/workflows/ci.yml`): `npm run check`, `npm test`, `next build` oraz testy z bazą na każdym PR i pushu do `main`. Workflow „Wydanie” (`release.yml`), opisany w `CONTRIBUTING.md`, którego dotąd nie było w repozytorium.
- `package-lock.json` (powtarzalne instalacje na Vercel i w CI), `.gitignore`, `.env.example` (wymieniany w README, a nieobecny).
### Dokumentacja
- `docs/PRZEGLAD-2026-10.md`: przegląd projektu, lista znanych błędów i ryzyk oraz plan dalszych kroków. Zaktualizowane HANDOFF, ROADMAP i ARCHITEKTURA.

## [0.28.1] - 2026-09
### Naprawiono
- Tryb ciemny: etykiety i siatka na wykresach SVG (zuzycie tygodniowe w Historii, radar skali odczuc, wykres w Dzienniku objawow) mialy na stale wpisane ciemne kolory tekstu, nieczytelne na ciemnym tle. Zamienione na zmienne motywu, ktore dopasowuja sie automatycznie.

## [0.28.0] - 2026-09
### Dodano
- "Twoj miesiac" - podsumowanie aktywnosci na gorze strony Historia: zuzyte gramy, aktywne dni, wykupione (z kosztem), srednia wystawiona ocena i najczesciej uzywana odmiana w biezacym miesiacu. Liczone wylacznie z juz istniejacych danych (usage_log, user_strain, purchases), bez zmian w bazie.

## [0.27.1] - 2026-09
### Naprawiono
- Tryb ciemny: kilka miejsc miało jasne tło bez ustawionego koloru tekstu, przez co tekst (dziedziczony jasny kolor motywu) był nieczytelny na jasnym tle. Dotyczyło to m.in. boksu "Twoje pola" na karcie odmiany, kodu zaproszenia (`<code>`), pozycji w rankingu poza podium oraz ramek w dziale Wiedza.
### Zmieniono
- Boks "Twoje pola" na karcie odmiany ma teraz tło dopasowane do motywu (jak reszta kart), z zielonym akcentem z lewej strony zamiast pełnego jasnego wypełnienia - lepiej pasuje do ciemnego motywu.
- Stan "hover" przycisków ghost/danger korzysta teraz z przezroczystej nakładki reagującej na motyw zamiast stałego jasnego koloru.
- Pasek animacji szkieletu ładowania dopasowuje się do motywu.

## [0.27.0] - 2026-09
### Dodano
- Wiedza: artykuły „Jak czytać etykietę i certyfikat badań (COA)” oraz „Słownik pojęć”.
- Skróty aplikacji po przytrzymaniu ikony na ekranie głównym telefonu: Nowa odmiana, Dziennik objawów, Recepty, Historia (wymaga ponownego dodania aplikacji do ekranu głównego).
- Przycisk „Udostępnij profil” (Web Share) na stronie Mój profil, widoczny na telefonie.
- Dziennik działań administratora obejmuje teraz także tworzenie kont, reset hasła i usuwanie kont.
- Test automatyczny poprawności treści działu Wiedza (unikalne identyfikatory, komplet pól, unikalne kotwice terpenów).
### Zmieniono
- Kont administratora nie można usunąć przez panel (KON-8). Usunięcie nieistniejącego użytkownika zwraca teraz błąd 404 zamiast potwierdzenia.
### Dokumentacja
- HANDOFF: zasady dostarczania paczek (całe foldery, najpierw usuń stary folder), procedura wgrywania przez github.dev, pułapki skryptów poprawek oraz odświeżone następne kroki.

## [0.26.0] - 2026-09
### Dodano
- Udostępnianie linku zaproszenia przez natywne menu telefonu (Web Share, MOB-14): przycisk "Udostępnij" obok "Kopiuj link" w panelu Zaproszeń (widoczny na telefonie).

## [0.25.0] - 2026-09
### Dodano
- Przypomnienie o kończącej się recepcie (PAC-16, częściowo): baner na stronie głównej, gdy recepta wygasa za 7 dni lub mniej (albo już wygasła) i zostało z niej niewykorzystane ilości.

## [0.24.0] - 2026-09
### Dodano
- Podpowiadanie nazw odmian z katalogu przy dodawaniu nowej odmiany (KAT-2): pole „Odmiana" podpowiada nazwy z katalogu, zawężone do wybranego producenta.
### Uwagi
- W tej sesji kilka wgrań przez github.dev nadpisało całe foldery `app` i `lib` zamiast dodać pojedyncze pliki (przeciąganie folderu na istniejący folder o tej samej nazwie **zastępuje go całkowicie**). Zasada na przyszłość: zawsze najpierw usuń stary folder w drzewie, dopiero potem wrzuć nowy w puste miejsce. Zapisane w `docs/HANDOFF.md`.

## [0.23.0] - 2026-09
### Dodano
- Dziennik działań administratora (`audit_log`): tworzenie i usuwanie zaproszeń, zmiana planu użytkownika, zamykanie zgłoszeń. Panel „Dziennik działań administratora" w Użytkownicy (ostatnie 1000 wpisów, widok 50 najnowszych). Realizuje ADM-1 z `ROADMAP.md`.

## [0.22.2] - 2026-09
### Naprawiono
- Krytyczny błąd: strona główna ("/") kończyła się błędem serwera (`ReferenceError: s is not defined`) z powodu literówki `(s) =` zamiast `(s) =>` w `StrainsBoard.js` (funkcja `canDelete`), wprowadzonej przy automatycznej edycji w wersji 0.19.0. Sprawdzono cały projekt pod kątem tego samego wzorca - innych wystąpień nie znaleziono.

## [0.22.1] - 2026-09
### Naprawiono
- Klawiatura numeryczna na telefonie pojawia się teraz też w polach: minimalne THC (koło fortuny, rankingi), przepisana ilość (recepty), próg „Kończy się” i limit miesięczny (ustawienia), liczba użyć i ważność zaproszenia (panel admina).

## [0.22.0] - 2026-09
### Zmieniono
- Formularz dodawania i edycji odmiany na telefonie otwiera się teraz jako pełnoekranowy arkusz z przyklejonym paskiem u góry ("← Wróć" i tytuł) zamiast wąskiej karty wciśniętej między inne elementy listy. Na komputerze wygląd bez zmian.
### Uwagi
- Formularze testów (dodawanie/edycja opinii z testu) zostają na razie w dotychczasowym, kompaktowym układzie — są krótsze i mniej problematyczne na małym ekranie niż formularz odmiany. Rozważyć w kolejnej wersji, jeśli zgłoszona zostanie taka potrzeba (MOB-6 w `ROADMAP.md`).

## [0.21.0] - 2026-09
### Zmieniono
- Tryb ciemny przepisany na zmiennych CSS zamiast filtra odwracającego kolory całej strony: tła, karty, linie, tekst i akcenty mają teraz dedykowane, ręcznie dobrane kolory ciemne. Wygląda naturalnie zamiast "wyblakle/fioletowo", zdjęcia i wykresy nie są już zniekształcane filtrem.
- Motyw systemowy (`prefers-color-scheme`) jest respektowany, dopóki użytkownik nie wybierze ręcznie trybu w aplikacji.
### Naprawiono
- Wybór trybu jasnego zapamiętywał się niepoprawnie na urządzeniu z ciemnym motywem systemowym (po odświeżeniu wracał tryb ciemny).
### Uwagi
- Część drugorzędnych plakietek i chipów ma nadal stałe jasne kolory (celowo, jako akcent) — pełny przegląd kontrastu w trybie ciemnym to UX-1/UX-2 w `ROADMAP.md`.

## [0.20.0] - 2026-09
### Dodano
- Szkielety ładowania (`loading.js`) dla listy odmian, katalogu, rankingów i podstrony odmiany — widoczna treść pojawia się od razu zamiast pustego ekranu.
- Leniwe ładowanie (code-splitting) koła fortuny, wykresu odczuć i rankingów — mniej kodu JS do pobrania i uruchomienia przy pierwszym wejściu na inne strony.
- Podstawowe wsparcie offline (PWA): service worker cache'uje wyłącznie powłokę aplikacji (ikony, manifest) i pokazuje `offline.html` przy braku sieci. Dane i API nigdy nie są cache'owane, więc zawsze są aktualne.
### Uwagi
- To pierwszy krok wydajności mobilnej (MOB-9/MOB-8 z `ROADMAP.md`). Skrócenie danych listy odmian (MOB-10) i pełny tryb offline z zapisem w tle zostają na kolejne wersje.

## [0.19.0] - 2026-09
### Dodano
- Wersja mobilna, część 2: pływający przycisk „+” z szybkimi akcjami (nowa odmiana, objawy dnia, historia), filtry i sortowanie w zwijanym panelu z licznikiem aktywnych filtrów, karta odmiany ze zwiniętymi szczegółami (opinia, cena, zakup, wpisy innych osób) oraz przyciskiem „Więcej”.
- Lista odmian pokazuje po 30 kart i przycisk „Pokaż więcej” (mniej elementów na telefonie).
### Zmieniono
- Czcionka nagłówków ładuje się bez dodatkowej osi „SOFT” (mniejszy plik).
- Eksport i import CSV przeniesione do panelu filtrów.
### Naprawiono
- Zdjęcia (odmiany, testy, profil) otwierają się teraz w podglądzie na cały ekran z widocznym przyciskiem zamknięcia (×), zamiast w nowej karcie przeglądarki, z której na telefonie nie dało się łatwo wrócić. Zamyka też klawisz Escape i dotknięcie tła.

## [0.18.0] - 2026-09
### Dodano
- Karta charakterystyki odmiany (podstrona odmiany i katalog): opis, rodzaj, stężenia, terpeny, smak, średnia ocen odczuć i tagi, średnia cena, źródła oraz stałe zastrzeżenie, że informacje są poglądowe i należy je ustalać z lekarzem.
- Podpowiedź z internetu w formularzu odmiany („Uzupełnij z internetu”): wyszukiwanie w wybranych serwisach o konopiach (Leafly, AllBud, Wikileaf, Seedfinder; lista w `SUGGEST_DOMAINS`) przez API Anthropic z narzędziem wyszukiwania; wypełnia opis, terpeny, rodzaj, THC/CBD i smak, zapisuje źródła. Wynik jest tylko podglądem: użytkownik sprawdza go i zapisuje sam. Wyniki są w pamięci podręcznej (90 dni), limit 15 podpowiedzi dziennie na użytkownika.
- Ceny użytkowników: pole „Cena u mnie (zł/g)” w karcie odmiany; średnia cena pojawia się od 3 zgłoszeń.
- Szczegóły odmiany w katalogu (`/katalog/[id]`), z przyciskiem dodania do własnych odmian lub przejścia do pełnej karty.
### Zmieniono
- Opis odmiany jest prezentowany jako karta charakterystyki; opisy z internetu są oznaczone.
- Polityka prywatności (projekt) opisuje podpowiedzi z internetu i średnie ceny.

## [0.17.1] - 2026-09
### Naprawiono
- Zużycie: zapis działa także wtedy, gdy zapisany stan („Mam teraz”) wynosi 0 g (wcześniej kończył się błędem); wpis zawsze trafia do dziennika, a stan nie spada poniżej 0. Dodano przyciski szybkich dawek (0,1; 0,25; 0,5; 1 g) i czytelniejszy komunikat.
- Skalowanie na telefonach: przełączniki (zakładki filtrów) zawijają się zamiast być szersze niż ekran; strona nie może już wychodzić poza szerokość ekranu.

## [0.17.0] - 2026-09
### Dodano
- Wersja mobilna: dolny pasek nawigacji (Odmiany, Katalog, Szukaj, Znajomi, Więcej) z arkuszem „Więcej”, plakietkami powiadomień i obsługą wcięć ekranu (safe-area).
- Dostosowanie do dotyku: cele dotykowe co najmniej 44 px, pola formularzy 16 px (bez powiększania na iOS), brak opóźnienia dotknięcia.
- `viewport` z `viewport-fit=cover` i kolorem motywu przeglądarki.
- `docs/HANDOFF.md`: notatka przekazania prac (stan, zasady, pułapki, następne kroki, prompt startowy dla Claude).
### Zmieniono
- Na telefonie górne menu jest ukryte (zastępuje je dolny pasek); ramka oceny na kartach jest mniejsza.
- Tryb ciemny nie filtruje już całej strony, tylko jej treść, dzięki czemu dolny pasek pozostaje przypięty do ekranu.

## [0.16.0] - 2026-09
### Dodano
- Testy automatyczne funkcji czystych (tagi efektów, CSV, terminy ważności, plany, dozwolone wartości), polecenie `npm test`.
- Własny dziennik błędów: zapis nieobsłużonych błędów serwera, tras API i przeglądarki (`error_log`) oraz panel „Dziennik błędów” w panelu admina.
### Naprawiono
- Nieudane założenie konta nie zużywa już kodu zaproszenia (KON-2).
### Zmieniono
- Workflow CI uruchamia kontrolę projektu oraz testy.

## [0.15.0] - 2026-09
### Dodano
- Dziennik objawów: dzienne wpisy (ból, jakość snu, lęk, nastrój, notatka), wykres z 30 dni z nałożonym zużyciem.
- Sekcja objawów w raporcie dla lekarza (średnie z wybranego okresu).
- Statystyki serwisu w panelu admina (same liczby, bez danych zdrowotnych).
- Dokumentacja projektu: `CHANGELOG.md`, `ROADMAP.md`, `CONTRIBUTING.md`, `docs/ARCHITEKTURA.md`, szablony zgłoszeń i PR, workflow wydań.
- Numer wersji w menu i punkt `/api/version`.
### Zmieniono
- Skrypt `npm run check` sprawdza teraz, czy bieżąca wersja z `package.json` ma wpis w `CHANGELOG.md`.

## [0.14.0] - 2026-09
### Dodano
- Edycja własnych testów (opis, widoczność, zdjęcie).
- Opisy skali odczuć (relaks, energia, sen, ból, apetyt) pomagające wystawiać oceny.
- Automatyczne tagi efektów odmiany (średnia widocznych ocen ≥ 6,5), filtr „Efekt” i wyszukiwanie po tagach.
- Rozbudowane rankingi: filtry rodzaju, postaci, tagu, producenta i zakresu THC; suma lub średnia ocen.

## [0.13.0] - 2026-09
### Dodano
- Eksport wszystkich danych użytkownika (JSON, opcjonalnie ze zdjęciami).
- Automatyczne cotygodniowe kopie zapasowe w bazie (8 ostatnich), ręczne tworzenie i pobieranie.
- Raport dla lekarza do druku lub zapisu jako PDF.
- Fundament planów: `plan` użytkownika, `PREMIUM_ENFORCED`, ręczne nadawanie Premium, strona „Premium i wsparcie”, przycisk wpłat (`DONATE_URL`).
- Notatnik recept z paskiem postępu wykupu.

## [0.12.0] - 2026-09
### Dodano
- Menu „Więcej”, przyjazne strony błędów i 404.
- Limit prób logowania i rejestracji (tabela `rate_limits`).
- Skrypt kontrolny `npm run check` i workflow CI (brakujące pliki, eksporty, niedozwolone eksporty tras API).
- Tryb ciemny (przełącznik, wersja wstępna oparta o odwrócenie kolorów) i wyszukiwarka ogólna.

## [0.11.0] - 2026-09
### Dodano
- Grupy: tworzenie, zaproszenia znajomych, ranking grupy.
- Pole „Postać” (susz, olej, pen) w odmianach, katalogu, imporcie i eksporcie.
- Moderacja: zgłaszanie profili i testów, blokowanie użytkowników, panel zgłoszeń admina.
- Liczniki powiadomień w menu.

## [0.10.1] - 2026-09
### Naprawiono
- Strona główna zgłaszała błąd 500 z powodu usuniętej przez pomyłkę funkcji `dailyUse`.

## [0.10.0] - 2026-09
### Dodano
- Rejestracja z kodem zaproszenia, zaproszenia w panelu admina.
- Profile (awatar, opis, linki), unikalne adresy `/u/nick`, znajomi i wyszukiwarka użytkowników.
- Widoczność ocen, opinii i testów: tylko ja, znajomi, znajomi znajomych, wszyscy zalogowani.
- Tablica profilu, usuwanie konta, regulamin i polityka prywatności (projekt roboczy).
### Zmieniono
- Stany, „do wykupienia”, zużycie i zakupy są zawsze prywatne. Rankingi wspólne liczą tylko udostępnione oceny.

## [0.9.0] - 2026-09
### Dodano
- Katalog odmian dostępnych w Polsce: import CSV przez admina i automatyczna aktualizacja z konfigurowalnego źródła (Vercel Cron).
- Przełącznik „Wszystkie / Moje odmiany”.
- Kopia zapasowa bazy do pliku JSON dla admina.

## [0.8.0] - 2026-09
### Dodano
- Porównywarka odmian, skala odczuć z wykresem radarowym, koło fortuny z filtrami.
- Eksport i import CSV, ikona aplikacji (PWA).
- Zakupy z limitem miesięcznym, historia zakupów i zużycia, wykres zużycia tygodniowego, próg „Kończy się”, linki terpenów do działu Wiedza.

## [0.7.0] - 2026-09
### Dodano
- Cena za gram, numer serii, data ważności; koszt zużycia z 30 dni.

## [0.6.0] - 2026-09
### Dodano
- Dział Wiedza: terpeny, trichomy, kush/haze/sour, indica/sativa/hybryda, THC i CBD.
- Dziennik zużycia, prognoza zapasu, znacznik „Kończy się”.

## [0.5.0] - 2026-09
### Dodano
- Wspólna pula „do wykupienia” dla odmian o tym samym producencie i stężeniu THC i CBD.
- Podstrona odmiany, testy ze zdjęciami.

## [0.4.0] - 2026-09
### Dodano
- THC i CBD, rodzaj (indica, sativa, hybryda) z kolorami, sortowanie i filtry, zdjęcie podglądowe, profil terpenowy, opis.

## [0.3.0] - 2026-09
### Dodano
- Koło fortuny, rankingi (tydzień, miesiąc, ogółem; wspólne i osobiste).

## [0.2.0] - 2026-09
### Dodano
- Lista odmian, pola wspólne i osobiste, listy wyboru z dopisywaniem opcji.

## [0.1.0] - 2026-09
### Dodano
- Fundament: Next.js, baza Neon (Postgres), logowanie, konto admina Bocian, wymuszona zmiana hasła, zarządzanie kontami, motyw konopny.

[Unreleased]: https://github.com/bocianek22/zielnik/compare/v0.30.0...HEAD
[0.30.0]: https://github.com/bocianek22/zielnik/compare/v0.29.0...v0.30.0
[0.29.0]: https://github.com/bocianek22/zielnik/compare/v0.28.2...v0.29.0
[0.28.2]: https://github.com/bocianek22/zielnik/compare/v0.28.1...v0.28.2
[0.28.1]: https://github.com/bocianek22/zielnik/compare/v0.28.0...v0.28.1
[0.28.0]: https://github.com/bocianek22/zielnik/compare/v0.27.1...v0.28.0
[0.27.1]: https://github.com/bocianek22/zielnik/compare/v0.27.0...v0.27.1
[0.27.0]: https://github.com/bocianek22/zielnik/compare/v0.26.0...v0.27.0
[0.26.0]: https://github.com/bocianek22/zielnik/compare/v0.25.0...v0.26.0
[0.25.0]: https://github.com/bocianek22/zielnik/compare/v0.24.0...v0.25.0
[0.24.0]: https://github.com/bocianek22/zielnik/compare/v0.23.0...v0.24.0
[0.23.0]: https://github.com/bocianek22/zielnik/compare/v0.22.2...v0.23.0
[0.22.2]: https://github.com/bocianek22/zielnik/compare/v0.22.1...v0.22.2
[0.22.1]: https://github.com/bocianek22/zielnik/compare/v0.22.0...v0.22.1
[0.22.0]: https://github.com/bocianek22/zielnik/compare/v0.21.0...v0.22.0
[0.21.0]: https://github.com/bocianek22/zielnik/compare/v0.20.0...v0.21.0
[0.20.0]: https://github.com/bocianek22/zielnik/compare/v0.19.0...v0.20.0
[0.19.0]: https://github.com/bocianek22/zielnik/compare/v0.18.0...v0.19.0
[0.18.0]: https://github.com/bocianek22/zielnik/compare/v0.17.1...v0.18.0
[0.17.1]: https://github.com/bocianek22/zielnik/compare/v0.17.0...v0.17.1
[0.17.0]: https://github.com/bocianek22/zielnik/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/bocianek22/zielnik/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/bocianek22/zielnik/releases/tag/v0.15.0
