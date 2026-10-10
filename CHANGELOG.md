# Historia zmian

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersjonowanie zgodne z [SemVer](https://semver.org/lang/pl/) (`MAJOR.MINOR.PATCH`).
Do wersji 1.0.0 (publiczny start) każda nowa funkcja podnosi `MINOR`, a poprawka błędu `PATCH`.

Wersje 0.1.0 do 0.14.0 zostały odtworzone z historii prac (wgrywanych paczkami przez GitHub). Nie mają znaczników `git`.
Pierwsze wydanie ze znacznikiem to **v0.15.0**. Kolejne wydania tworzy workflow „Wydanie” (patrz `CONTRIBUTING.md`).

## [Unreleased]

## [0.56.0] - 2026-10
### Dodano
- **PDF raportu w APK:** wtyczka `ZielnikShare.sharePdf` (`SharePlugin.java`): zapis do `cache/share/` (sprzątany przy starcie i przed kolejnym udostępnieniem), FileProvider tylko dla tej ścieżki i zdjęć z aparatu, `ACTION_SEND` z prawem odczytu, bez nowych uprawnień. W APK 0.5.0 przycisk „Udostępnij PDF” obok „Drukuj”; starsze APK bez zmian.
- **Dyktowanie notatek (POM-43):** `DictateButton` z Web Speech API (`pl-PL`, wyniki na żywo, rozpoznawanie na urządzeniu, gdy dostępne), informacja o dostawcach mowy przy pierwszym użyciu, ukryty w APK i bez API; w dzienniku, „Do omówienia” i opisie testu.
- **Notatka o partii (POM-32):** przy zakupie numer partii, ważność, ocena „słabiej / jak zwykle / mocniej” i notatka szyfrowana (`purchases.batch_*`, AAD `user_id|id`); `PUT /api/history/purchases/[id]/batch`; w Historii, na karcie odmiany („Partie”), eksporcie JSON/CSV, kopii, imporcie kopii i raporcie (tylko z „Dołącz moje spostrzeżenia”).
- **Role w grupach (SPO-3):** moderator (nadaje i odbiera właściciel) usuwa wiadomości i zwykłych członków; właściciel przekazuje grupę aktywnemu członkowi (atomowo).
### Zmieniono
- `mobile/` 0.5.0 (nowe APK z CI).

## [0.55.0] - 2026-10
### Dodano
- **Raport jako PDF (POM-40):** „Pobierz PDF” i (telefon z Web Share) „Udostępnij PDF” w raporcie; PDF generowany lokalnie przez `pdf-lib` + `@pdf-lib/fontkit` ładowane po kliknięciu (osobny chunk ok. 176 KB gzip), czcionka Figtree TTF z polskimi znakami w `public/fonts/` (OFL), A4 czarno-biały, nagłówek okresu, „Strona X z Y”, nagłówki tabel na każdej stronie, neutralna nazwa `raport-RRRR-MM-DD.pdf`. Na telefonie plik przygotowywany zawczasu (Safari wymaga świeżego gestu). APK: bez zmian („Udostępnij / Zapisz PDF” przez okno druku). Model raportu liczony na serwerze (`lib/report-pdf-model.js`), układ w czystych funkcjach (`lib/report-pdf-layout.js`); bardzo długa komórka przycinana ze znacznikiem.
- **Kalendarz zużycia (UI A5):** w Historii kwartał lub rok, g/ml, stany dnia rozróżnione kształtem (brak wpisu, dzień bez zużycia, poziomy zużycia, dziś), klawiatura i dotyk, tabela dla czytnika (`lib/usage-calendar.js`, `charts/Calendar.js`, `charts/calendar-grid.js`).
- **Pora przyjęcia:** rozkład zapisów zużycia na cztery pory dnia z 90 dni.
- **Mikrointerakcje (UI B4):** podświetlenie zmienionej liczby (`Bump`), wejście kart, przejścia ekranów (View Transitions w przeglądarce); wszystko wyłączone przy `prefers-reduced-motion`.
### Zmieniono
- Service worker: czcionki PDF w pamięci podręcznej (`zielnik-shell-v2`), PDF działa bez sieci.

## [0.54.0] - 2026-10
Redesign „Design 3” (kierunek B z elementami A, `docs/DESIGN-3.md`) po uwagach testerów bety, czat w grupach (SPO-2), „Mój miesiąc” (POM-42).
### Dodano
- **Design 3:** tokeny z kolorami obszarów (`--cat-*` z wariantami `-soft`/`-ink`), hero z gradientem, kafle KPI, ikony w kółkach, karty z cieniem; jeden krój (Figtree); nowe zasady w `docs/DESIGN.md`; test kontrastu wszystkich par tekst/tło w obu motywach (`tests/theme.test.js`).
- **Nawigacja:** dolny pasek Dziś / Odmiany / „+” / Dziennik / Więcej, arkusz „Więcej” w grupach z kolorowymi ikonami; lista odmian na osobnym ekranie `/odmiany` (stare `/?new=1` i `/?q=` przekierowują), widżet Androida odświeżany także stamtąd.
- **Dziś:** hero z pierścieniem dni zapasu i przyciskami Zużyłem/Wykupiłem, kafle (recepta, nastrój, dziś zużyto, „Kończy się” tylko z powodem), lista „Do zrobienia”, karta wykresu 14 dni.
- **Odmiany:** kafle liczb, przełącznik Moje / Katalog / Rankingi, wiersze z miniaturą w kolorze rodzaju, menu „⋯” (Porównaj, Edytuj), hero szczegółów z kaflami ocen i ilustracją słoika bez zdjęcia.
- **Dziennik, historia, recepty, raport, profil, obserwacje:** hero w kolorze obszaru, karty z nagłówkami sekcji, trend objawów opisowo w pigułce, recepty z kaflem dni, neutralne notki o prywatności.
- **Czat w grupach (SPO-2):** wiadomości dla aktywnych członków (1–2000 znaków), szyfrowane w bazie jak notatki; edycja do 15 min, usuwanie (autor, właściciel grupy, admin z audytem), zgłoszenia z zaszyfrowaną migawką treści, licznik nieprzeczytanych, odświeżanie co ~5 s; w eksporcie danych, bez importu kopii. Tabela `group_messages`, kolumny `group_members.last_read_message_id`, `reports.snapshot`.
- **„Mój miesiąc” (POM-42):** w Historii porównanie ostatnich 30/90 dni z poprzednim okresem (zużycie g i ml osobno, dni z użyciem, wykup, średnie objawów), różnice neutralne; słupki tygodniowe z przełącznikiem g/ml (`lib/recap.js`).
- **Motyw:** wybór Systemowy / Jasny / Ciemny także w menu „Więcej” i w nagłówku; Systemowy domyślnie.
### Zmieniono
- Testy: dzień w czasie polskim w `seed.mjs` i testach z bazą (po 22:00 UTC padały); stabilniejsze E2E (hydratacja, efekty); axe i cele 44 px na wszystkich ekranach, także czatu.

## [0.53.0] - 2026-10
UI 2.0, etapy A1, A2, A3, B2, B3 (`docs/UI-2.md`), po przeglądzie Opus.
### Dodano
- **Moduł wykresów `app/components/charts/`:** inline SVG bez nowych zależności (`Frame`, `Bars`, `Scrub` ze strzałkami, Home/End i Escape, `Empty`, tabela dla czytnika), reguły w `app/styles/charts.css`.
- **Paleta `--chart-1…7` i tokeny pomocnicze** (`--chart-data`, `--chart-ref`, `--chart-band`, `--chart-grid`, `--chart-axis`) sprawdzone pod kątem daltonizmu i kontrastu w obu motywach (`tests/theme.test.js`); sekcja „Wykresy” w `docs/DESIGN.md`.
- **Prognoza zapasu (Dziś):** linia spadku zapasu z pasmem od najwolniejszego do najszybszego tygodnia z ostatnich 4, data końca i kreska ważności recepty; podpis „przy obecnym tempie zapisów”, bez pasma przy mniej niż 14 dniach zapisów (`lib/forecast.js`, `dailyUse().forecast`; `daysLeft` widżetu bez zmian).
- **Słupki 14 dni:** wartość przy najwyższym, linia średniej, przesuwanie palcem i strzałkami z odczytem `aria-live`.
- **Dziennik:** małe wykresy objawów (po jednym na objaw), wygładzenie tylko przy wystarczającej liczbie wpisów, osobny panel zużycia, na komputerze „Osobno / Razem”.
### Zmieniono
- **Dziś:** przy dwóch jednostkach jeden blok zapasu z dwiema kolumnami, prognozy w zwijanym wierszu „Prognoza i wykupy”; „Zużyłem” na pierwszym ekranie telefonu.
- **Lista i szczegóły odmiany:** stan pod oceną (tylko gdy jest zapas), meta w jednej linii, bez szarego pudełka, Eksport/Import CSV w „Więcej”, nowa kolejność sekcji szczegółów.
- **Dziennik, historia, recepty, profil:** wykres nad formularzem i zwinięty wpis z dziś (fokus wraca na nagłówek lub pole daty), pasek trzech liczb w historii, krótsza uwaga w receptach i jedna karta „W aptece”, profil w sekcjach z „Dodaj link”.
### Naprawiono (przegląd)
- „Więcej” w filtrach był na telefonie niewidoczny w jasnym motywie.
- Prognoza: pierwszy tydzień nie liczy dzisiejszego dnia przed wpisem; skrajny zapas nie wywraca panelu (`addDays`).

## [0.52.0] - 2026-10
Pierwsze wydanie fali 6 (UI 2.0 i nowość w każdym wydaniu, `docs/PLAN-PAZDZIERNIK.md`, projekt `docs/UI-2.md`).
### Dodano
- **Przywracanie z kopii (POM-41):** na „Import” (link w profilu przy eksporcie) można wgrać plik JSON z „Pobierz dane (JSON)”, także na nowe konto.
  - Najpierw podgląd: ile pozycji z każdej sekcji zostanie dodanych, pominiętych albo odrzuconych; potem „Importuj”.
  - Przywracane: wpisy odmian (oceny, stany, odczucia, notatki), „do wykupienia”, zużycie, zakupy (z powiązaniem recepty), recepty, testy bez zdjęć, dziennik samopoczucia, własne objawy, „Do omówienia”, dni bez zużycia, ustawienia przypomnień.
  - Wszystko prywatne, w jednej transakcji, idempotentnie (ten sam plik można wgrać ponownie, istniejące wiersze nie są nadpisywane). Odmiany spoza katalogu są pomijane z informacją.
  - Nie są przenoszone: znajomi, grupy, zgody, sesje, zgłoszenia, zdjęcia i dane innych osób. Notatki są szyfrowane na nowym koncie (gdy działa szyfrowanie).
  - `POST /api/account/import`: limit 4 MB, podgląd 30/h, zapis 5/h, limity wierszy na konto; `jsonBody(req, maxBytes)` zwraca 413 przy zbyt dużej treści.
- **Potwierdzenia zapisu (UI 2.0, etap B1):** wspólny komponent `Toast` z opcjonalnym „Cofnij” przy zużyciu, wykupie, objawach i profilu; `aria-busy` na przyciskach zapisu; ikona `trend`.
### Zmieniono
- Eksport JSON: `usage`, `purchases` i `tests` zawierają producenta, a daty recept to tekst `RRRR-MM-DD` (wcześniej północ w strefie serwera).
- Dokumenty: projekt interfejsu `docs/UI-2.md`, lista usług do zakupu `docs/ZAKUPY.md`.

## [0.51.0] - 2026-10
Poprawki z przeglądu gotowości do 1.0 (`docs/PRZEGLAD-1.0.md`).
### Bezpieczeństwo
- **Eksport CSV:** teksty zaczynające się od `= + - @` są neutralizowane (wstrzyknięcie formuł przez nazwy ze wspólnego katalogu), także w CSV z panelu admina.
- **Limity tworzenia treści:**
  - odmiany 20/h, opcje 30/h, testy 30/h i najwyżej 50 na odmianę, zaproszenia 30/h, recepty 30/h;
  - zgłaszanie odmian i zdjęć odmian; admin może usunąć zdjęcie i zamknąć zgłoszenie.
- **Nieprawidłowy JSON:** wspólne `jsonBody()` w 51 trasach daje 400 zamiast 500 (logowanie: limit prób przed parsowaniem).
- **Pobieranie kopii przez admina:**
  - wymaga ponownego podania hasła (`POST /api/backup`), limit 5 prób na 15 minut;
  - `GET /api/backup` zwraca teraz 405.
- **Web Push:** subskrypcje tylko z dozwolonych hostów usług push, sprawdzane także przy wysyłce.
### Zmieniono
- Kopia zapasowa codziennie zamiast raz w tygodniu.
- Wyszukiwarka nie pokazuje kont z profilem „Tylko ja” (poza znajomymi).
- Wieczorne przypomnienie o objawach nieaktywne i opisane, dopóki cron nie działa co godzinę.
- Usunięcie konta w jednej transakcji.
- `ROADMAP.md`: stan listy kontrolnej 1.0.

## [0.50.0] - 2026-10
### Dodano
- **Szyfrowanie notatek w bazie (POM-28, projekt w `docs/SZYFROWANIE-NOTATEK.md`), za kluczem `DATA_ENCRYPTION_KEY`; bez klucza wszystko działa jak dotąd.**
  - Notatki objawów, wpisów odmian, recept i testów zapisywane jako AES-256-GCM (`zenc1:<kid>:…`), z AAD wiążącym szyfrogram z kontem i wierszem; rotacja kluczy.
  - Odczyt jawnych wierszy bez zmian. Eksport, raport, CSV i profil znajomego zawsze odszyfrowane.
  - Nieczytelna notatka (brak klucza, usunięty klucz) nie jest nadpisywana przy zapisie; zły format klucza nie blokuje zapisów ani kolejki offline.
- `scripts/encrypt-notes.mjs`: przepisanie istniejących notatek porcjami (`--dry-run`, `--batch`, `--table`, `--decrypt` do wycofania, rotacja).
- Panel „Gotowość”: stan klucza i postęp szyfrowania (same liczby); `backup-decrypt --data-key`; próba odtworzenia kopii sprawdza notatki.
### Uwaga przy wdrożeniu
- Bez migracji bazy.
- Włączanie:
  1. klucz w menedżerze haseł i druga kopia offline, osobno od `BACKUP_ENCRYPTION_KEY`; utrata klucza oznacza utratę notatek;
  2. `DATA_ENCRYPTION_KEY` w Vercel;
  3. wdrożenie;
  4. `scripts/encrypt-notes.mjs`.
- Wycofanie: najpierw `--decrypt`, potem wdrożenie starego kodu.
- „Do omówienia z lekarzem” na razie bez szyfrowania (czeka na decyzję o ograniczeniu długości w bazie).

## [0.49.1] - 2026-10
### Naprawiono
- Safari i iPhone:
  - pola nazwy użytkownika i kodu zaproszenia bez automatycznej wielkiej litery i autokorekty;
  - wysokość arkuszy i okien liczona z `dvh` (z `vh` jako zapasem);
  - pola daty i godziny nie rozpychają formularzy;
  - pełna nazwa „Do ekranu początkowego” w instrukcji powiadomień.
### Dodano
- Testy E2E na szerokości komputera (1280 i 1024 px): wszystkie główne ekrany, raport w wersji do druku, eksport konta, panel admina.
- `docs/TEST-RECZNY.md`: lista do ręcznego testu przed zaproszeniami (Android APK i Chrome, iPhone Safari i PWA, komputer), z ryzykami z przeglądu pod Safari.
- `docs/BETA-ZAPROSZENIE.md`: wiadomość powitalna dla grupy testerów, szablon zaproszenia, ankieta po dwóch tygodniach.

## [0.49.0] - 2026-10
Przygotowanie do zamkniętej bety (`docs/BETA.md`).
### Dodano
- **Zgłaszanie uwag:** „Zgłoś uwagę” (`/uwagi`, z menu „Więcej”, profilu, Pomocy i strony błędu).
  - Kategoria i opis; wersja, ekran (bez identyfikatorów), platforma i motyw dołączają się same, bez danych zdrowotnych.
  - Tester widzi status swoich zgłoszeń; admin ma zakładkę „Zgłoszenia” ze statusem i notatką.
  - Powiadomienie na webhook alertów bez treści zgłoszenia.
  - Link do grupy testerów (`BETA_GROUP_URL`).
- **„Co nowego”, Pomoc i oznaczenie wersji:**
  - okno „Co nowego” raz po aktualizacji (czeka, aż zniknie ekran blokady);
  - strona „Pomoc” (instalacja na Androidzie, iPhonie i komputerze, zgłaszanie, znane ograniczenia, FAQ);
  - wersja i oznaczenie „Beta” w profilu.
- **Regulamin bety i polityka prywatności:**
  - publiczne `/regulamin` i `/prywatnosc` (wersje robocze do przeglądu przez prawnika przed otwartą betą; kontakt administratora z `LEGAL_ADMIN_NAME`, `LEGAL_CONTACT_EMAIL`);
  - przy rejestracji dwie osobne zgody (regulamin i polityka; dane o zdrowiu, art. 9 RODO), zapis wersji dokumentów;
  - po zmianie wersji ekran ponownej akceptacji z opcjami „Pobierz moje dane” i „Usuń konto”.
  - historia zgód (`consent_log`) jako dowód zgody (art. 7 RODO), w eksporcie konta;
  - wersja dokumentów zawiera skrót danych administratora: ekran zgody pojawia się dopiero po ustawieniu `LEGAL_ADMIN_NAME` i `LEGAL_CONTACT_EMAIL`, a ich zmiana wymaga ponownej akceptacji;
  - ekran zgody nie przykrywa ekranu blokady PIN i odcisku palca, a „Co nowego” czeka na akceptację.
- Panel „Gotowość” pokazuje dodatkowo, ile wpisów ma widoczność „wszyscy” (stare wpisy sprzed domyślnej prywatności; aplikacja ich nie zmienia).
- **Panel admina „Gotowość”:** stan konfiguracji produkcji bez ujawniania wartości, wersja PostgreSQL, ostatnia kopia i ostatnie przebiegi cronów, błędy z 24 h.
- **`GET /api/health`** dla monitoringu dostępności.
- **Próba odtworzenia kopii:** `scripts/dev/restore-drill.mjs`.
- **Konto admina:** powiadomienie o każdym logowaniu admina.
- **Wskaźniki bety:** liczby zbiorcze, ukryte dla grup mniejszych niż 5 kont.
- **Widżet Androida „Zapas i Zużyłem” (POM-13), APK 0.4.0:** do telefonu trafia tylko data końca zapasu; przy blokadzie widżet nie pokazuje liczby.
### Zmieniono
- Limity: zapis zakupu 300 na godzinę, „Do omówienia” 60 zapisów na godzinę (kolejka offline ponawia).
- Eksport konta: `feedback`, `reportsFiled`, `consentAt`, `consentVersion`.
### Uwaga przy wdrożeniu
- **Migracja addytywna:** tabele `beta_feedback`, `consent_log` (z jednorazowym wpisem dotychczasowej zgody z rejestracji), `users.consent_version`.
- **Wszystkie istniejące konta** (także admin) zobaczą ekran akceptacji dokumentów przy pierwszym wejściu po ustawieniu `LEGAL_ADMIN_NAME` i `LEGAL_CONTACT_EMAIL`; nikt nie jest wylogowywany.

## [0.48.0] - 2026-10
### Dodano
- Powiązanie zakupów z receptą (POM-16, PAC-4): „Wykupiłem” przypisuje zakup do recepty (automatycznie: ważna w dniu zakupu, ta sama jednostka, z pozostałą ilością, najbliższa wygaśnięcia; przy kilku pasujących wybór „Z której recepty”, także „bez recepty” dla zakupu prywatnego). Przypisane zakupy liczą się tylko do swojej recepty, więc nakładające się recepty nie liczą tych samych gramów. W Historii można zmienić przypisanie; na recepcie widać, ile gramów pochodzi z szacunku (stare zakupy bez przypisania). Kolejka offline: brakująca recepta nie odrzuca zapisu (tryb automatyczny).
- Kreator pierwszego uruchomienia (POM-19, UX-6): nowe konto przechodzi trzy kroki do pominięcia (odmiana i stan, recepta, przypomnienia i tryb dyskretny); stan zamknięcia na koncie, więc kreator nie wraca na innym urządzeniu. Istniejące konta i admin go nie widzą.
- Puste stany z akcją (POM-20): panel „Dziś” („Dodaj odmianę” / „Wpisz stan”), „Moje obserwacje” bez wpisów.
- Projekt widżetu Androida (POM-13) w `docs/WIDZET-ANDROID.md`.
### Zmieniono
- „Moje odmiany” liczone jedną definicją na serwerze i w przeglądarce (ocena, stan, notatka albo własna odmiana).
### Uwaga przy wdrożeniu
- Migracja addytywna: `purchases.prescription_id`, `purchases.no_rx`, funkcje `rx_bought`, `rx_bought_est`, `users.onboarded_at` (dla kont sprzed wdrożenia ustawiane od razu).

## [0.47.0] - 2026-10
### Dodano
- Odzyskiwanie hasła e-mailem i weryfikacja adresu (KON-1, za kluczem `RESEND_API_KEY`): adres w profilu tylko za hasłem i zgodą, zawsze do potwierdzenia; „Nie pamiętam hasła” na `/login`, strony `/odzyskaj-haslo`, `/nowe-haslo`, `/potwierdz-email`. Ta sama odpowiedź i czas niezależnie od istnienia konta, token jednorazowy (30 min, w bazie tylko SHA-256, we fragmencie linku), reset unieważnia wszystkie sesje, linki tylko z `APP_URL` lub dozwolonych hostów, mail resetu zawsze jako „Notatnik”. Konta admina bez resetu e-mailem.
- Alerty o błędach serwera (PLA-2): webhook (`ALERT_WEBHOOK_URL`) i/lub e-mail (`ALERT_EMAIL`) po progu błędów w 15 min albo przy nowym rodzaju błędu; bez treści błędów, ścieżki z zamaskowanymi identyfikatorami, limity wysyłki; alert próbny w panelu admina.
- Przypomnienia (POM-05, POM-15, za kluczami push): wieczorne o wpisie objawów (tylko gdy dziś brak wpisu; wymaga crona co godzinę) i o wizycie (dzień wcześniej i w dniu), w profilu „Przypomnienia”; treść neutralna, domyślnie wyłączone; data wizyty w eksporcie i kopii.
### Zmieniono
- Cron przypomnień pracuje porcjami z kursorem i budżetem czasu, więc przy dużej liczbie kont nikt nie jest pomijany.
### Uwaga przy wdrożeniu
- Migracja addytywna: `users.email_verified_at`, `users.email_consent_at`, tabela `email_tokens` z wyzwalaczem (DROP/CREATE, działa na każdej wersji PostgreSQL), kolumny `push_prefs.notify_symptoms`, `symptoms_hour`, `notify_visit`, `next_visit_on`.

## [0.46.0] - 2026-10
### Dodano
- Propozycje zmian w katalogu (KAT-1, DT-7): twórca nieużywanej odmiany i admin edytują wspólne pola bezpośrednio, każdy inny wysyła propozycję; admin w zakładce „Propozycje” widzi różnice pole po polu (konflikty podświetlone), przyjmuje (także mimo konfliktu) albo odrzuca z powodem; autor widzi status w szczegółach odmiany i może wycofać oczekującą. Limity: 20 oczekujących na osobę, 30 na godzinę. Nowi producenci, typy i terpeny trafiają do wspólnych list dopiero po akceptacji. Eksport konta: `strainProposals`.
- Dostępność (UX-2, POM-21, POM-22): ustawienie „Większy tekst i przyciski” (na urządzeniu, bez migania), cele dotykowe ≥ 44 px (≥ 56 px w trybie dużym), pułapki fokusu z powrotem fokusu w blokadzie PIN, menu, podglądzie zdjęcia i formularzu odmiany na telefonie, tabela tekstowa dla wykresu odczuć, `prefers-reduced-motion`; testy axe (WCAG 2.2 AA) i klawiatury w E2E; opis w `docs/DOSTEPNOSC.md`.
### Naprawiono
- „Uzupełnij z internetu” prawie nigdy nie znajdowało danych, choć płaciło za wyszukiwania: odpowiedź z cytatami była sklejana z błędem (JSON nie dawał się odczytać), a wyszukiwanie ograniczały 4 zagraniczne serwisy, w których nie ma nazw aptecznych. Teraz: cały internet z perspektywy Polski (najpierw producent i polskie źródła, potem genetyka po samej nazwie), karta oddawana przez narzędzie ze schematem, wystarczą częściowe dane (np. samo THC i terpeny), wznowienie po `pause_turn`, źródła tylko spośród faktycznych wyników. „Nie znaleziono” zapamiętane na 7 dni (ponowna próba nic nie kosztuje), w dzienniku liczba wyszukiwań i tokenów każdego wywołania. Domyślny model: `claude-haiku-5-5` (`ANTHROPIC_MODEL`), `SUGGEST_DOMAINS` zawęża wyszukiwanie tylko, gdy ustawione.
- Błąd CSP w konsoli przy pełnym ładowaniu strony odmiany, koła i rankingów (podgląd skryptu `next/dynamic` bez nonce): zwykłe importy.
### Uwaga przy wdrożeniu
- Migracja addytywna: tabela `strain_proposals`, funkcje `strain_common_json`, `strain_used_by_others`.

## [0.45.0] - 2026-10
### Dodano
- Testy E2E na stałe (`tests/e2e/`, `npm run test:e2e`): 10 scenariuszy na 390 px (logowanie, „Zużyłem”/„Wykupiłem” z „Cofnij”, objawy z własnymi, „Dziś bez zużycia”, „W aptece”, „Do omówienia”, blokada PIN i „Zmień PIN”, tryb dyskretny, wylogowanie), każdy pada przy błędzie konsoli, CSP albo odpowiedzi ≥ 400; nowy job w CI.
- Budżety Lighthouse (POM-24, `npm run test:perf`, `tests/perf/budgets.json`) dla `/login` i `/`.
- Lekki indeks odmian (POM-35, PLA-5): `strainIndex`, stronicowanie kursorem `GET /api/strains?limit=&cursor=` (pole `next`) i `?view=index`; koło i rankingi z lżejszych zapytań; pamięć podręczna tylko wspólnego katalogu (60 s, unieważniana przy każdej zmianie odmian), nigdy danych użytkownika.
### Zmieniono
- Ikona karty przeglądarki (koniec 404 `/favicon.ico`); w trybie dyskretnym neutralny „notatnik”.
- Rankingi biorą najwyżej 500 najnowszych odmian (z informacją, gdy jest ich więcej).
### Uwaga przy wdrożeniu
- Migracja addytywna: indeksy `strains_created_idx`, `user_strain_stock_idx`, funkcja `strain_cursor`.

## [0.44.0] - 2026-10
### Dodano
- Porównanie odmian (POM-18, część): moje statystyki przy każdej odmianie: „Zużyłem razem”, „Średnio dziennie (12 tyg.)”, „Ostatnie użycie” (tylko moje zużycie).

## [0.43.0] - 2026-10
### Dodano
- „Do omówienia z lekarzem” w raporcie (POM-36): do 10 krótkich punktów przed wizytą (do 200 znaków), nieomówione drukowane w raporcie pod nagłówkiem; po wizycie odhaczane jako omówione albo usuwane. Prywatne, w eksporcie JSON (`doctorNotes`) i w kopii.
### Uwaga przy wdrożeniu
- Migracja addytywna: tabela `doctor_notes`.

## [0.42.0] - 2026-10
### Dodano
- Karta „W aptece” na stronie Recepty (POM-37): ile zostało na ważnych receptach (g i ml osobno) i co jest „do wykupienia” w pulach odmian (jedna pozycja na pulę, z nazwami pozostałych odmian puli) z przyciskiem „Wykupiłem”. Bez cen i aptek; nazwy rozmyte w trybie dyskretnym. Wykup od razu odświeża receptę.

## [0.41.0] - 2026-10
### Dodano
- „Dziś bez zużycia” w panelu „Dziś” (POM-38): znacznik dnia bez gramów (z „Cofnij”), widoczny tylko, gdy dziś nie zapisano zużycia; zapis „Zużyłem” zdejmuje znacznik. Neutralnie, bez serii i liczników.
- „Moje obserwacje”: kto oznacza dni bez zużycia, ma w grupie „Dni bez zużycia” tylko dni potwierdzone (zapomniany wpis nie zawyża tej grupy); bez oznaczeń działa jak dotąd.
- Dni bez zużycia w eksporcie JSON (`noUseDays`) i CSV (wiersz „Bez zużycia”) oraz w kopii.
### Uwaga przy wdrożeniu
- Migracja addytywna: tabela `no_use_days`.

## [0.40.0] - 2026-10
### Dodano
- „Zmień PIN” w blokadzie przeglądarki bez jej wyłączania (POM-33); obecny PIN liczy się do limitu prób, odcisk palca/twarz zostaje.
### Zmieniono
- Logowanie, rejestracja i zmiana hasła przez wspólną obsługę błędów `safe()` (JSON, `no-store`, dziennik błędów); komunikat błędu logowania nie podpowiada konfiguracji serwera (POM-34).
- `npm run check` wymaga `safe()` w każdej trasie API (wyjątek tylko z komentarzem `// bez safe(): powód`).

## [0.39.0] - 2026-10
### Dodano
- Własne objawy i skale (POM-07): do 3 własnych objawów na konto (nazwa, kierunek „wyżej = lepiej/gorzej”, skala 0-10) w dzienniku i szybkim wpisie w panelu „Dziś” (także offline), na wykresie, w „Moich obserwacjach” i w raporcie dla lekarza (opisowo). Prywatne, w eksporcie JSON i CSV (nowa ostatnia kolumna „Własne objawy”) i w kopii; nazwy rozmyte w trybie dyskretnym.
### Zmieniono
- Lżejszy ekran główny (POM-23): panel „Dziś” z jednego lekkiego zapytania pokazuje się od razu, lista odmian dochodzi w tle (strumieniowanie).
- Szybki wpis objawów zwija się po komplecie wbudowanych objawów.
### Naprawiono
- Raport: „dni z wpisem” liczy tylko dni z wbudowanym objawem lub notatką.
- Zapis objawów dnia i jego usunięcie w jednej transakcji; powtórzony identyfikator własnego objawu nie powoduje błędu serwera.
- Zapis z panelu „Dziś” odrzucony lub usunięty z kolejki offline przed wczytaniem listy cofa się poprawnie; „Dodaj odmianę” przed wczytaniem listy otwiera formularz po jej wczytaniu.
- Skrypt startowy blokady PIN pomija te same strony publiczne co ekran blokady.
### Uwaga przy wdrożeniu
- Migracja addytywna: tabele `symptom_custom`, `symptom_values`.

## [0.38.0] - 2026-10
### Dodano
- Lista sesji i urządzeń w profilu (POM-27): opis urządzenia (np. „Chrome, Android”), kraj, ostatnie użycie; wylogowanie pojedynczej sesji i „Wyloguj inne urządzenia”. Wylogowanie unieważnia sesję na serwerze, więc skopiowany token przestaje działać. Bez zapisu adresu IP i pełnego User-Agent.
- Blokada PIN-em w przeglądarce i PWA (POM-25): PIN 4-8 cyfr zapisany tylko jako skrót PBKDF2 na urządzeniu, opcjonalnie odcisk palca/twarz (WebAuthn), blokada po 1/5/15 min nieobecności, zasłona przy przełączaniu aplikacji, opóźnienia po błędnych próbach i wylogowanie po 10 błędach.
- Wylogowanie po bezczynności (opcja urządzenia: 1/8/24 h), także w aplikacji Android; przy niewysłanych zapisach offline czeka na sieć.
### Zmieniono
- Zmiana hasła wylogowuje pozostałe urządzenia, bieżące zostaje zalogowane.
- PIN poprzedniej osoby przestaje obowiązywać, gdy na urządzeniu zaloguje się ktoś inny.
### Uwaga przy wdrożeniu
- Migracja addytywna: tabela `sessions`. Dotychczasowe sesje działają dalej (bez wylogowania). Tabela nie trafia do kopii: odtworzenie bazy z kopii wylogowuje wszystkich.

## [0.37.0] - 2026-10
### Dodano
- Pora i sposób przyjęcia przy „Zużyłem” (POM-03): opcjonalne, zwinięte w panelu (pora domyślnie z godziny zapisu, sposób zapisywany tylko, gdy wybrany), korekta w Historii, sekcja „Pory dnia i sposób przyjęcia” w raporcie dla lekarza (liczba wpisów, bez wniosków), eksport.
- Eksport dziennika do CSV (POM-11) w profilu: objawy, zużycie (ze sposobem i porą) i zakupy, jednostki g/ml, czas polski, zakres dat, gotowy do Excela (separator „;”, BOM), ochrona przed formułami; neutralna nazwa pliku w trybie dyskretnym.
- Puste stany prowadzące do pierwszego wpisu (POM-20): panel „Dziś”, dziennik objawów, recepty, Historia, raport.
- Wspólne narzędzia deweloperskie `scripts/dev/` (build z lokalnym PostgreSQL przez `ZIELNIK_LOCAL_PG=1`, serwer, dane testowe, zrzuty).
### Zmieniono
- Bez nagłówka `X-Powered-By`.
### Uwaga przy wdrożeniu
- Migracja addytywna: `usage_log.method`, `usage_log.period`, funkcja `usage_period`.

## [0.36.0] - 2026-10
### Dodano
- Zapisy bez internetu (POM-14): „Zużyłem”, „Wykupiłem” i szybkie objawy trafiają do kolejki na urządzeniu (IndexedDB, powiązanej z kontem) i wysyłają się po powrocie sieci, bez duplikatów (`requestId`); licznik „N czeka” w nagłówku z panelem kolejki, „Cofnij” dla zapisów w kolejce; czas zapisu z telefonu (`at`, do 72 h wstecz).
- Aplikacja Android 0.3.0: „Udostępnij / Zapisz PDF” raportu przez systemowe okno druku (wtyczka `ZielnikPrint`), skróty pod ikoną: „Zapisz”, „Samopoczucie”, „Raport” (POM-12).
- Audyt bezpieczeństwa (`docs/BEZPIECZENSTWO.md`): CSP z nonce bez `unsafe-inline` (awaryjnie `CSP_REPORT_ONLY=1`), odrzucanie zapisów API z innej witryny (CSRF), `Cache-Control: no-store` dla API, usuwanie EXIF/GPS ze zdjęć i sprawdzanie ich zawartości, czyszczenie danych urządzenia przy wylogowaniu.
### Zmieniono
- Android: wyłączona kopia zapasowa aplikacji (ciasteczko sesji nie trafia na Dysk Google), tylko HTTPS.
- Rejestracja i logowanie nie zdradzają istnienia konta; zgłoszenia testów tylko dla testów zgłaszanej osoby widocznych dla zgłaszającego.
### Naprawiono
- Eksport danych konta przy nazwach z polskimi znakami; błędna data w usuwaniu wpisu objawów dawała błąd serwera.
### Uwaga przy wdrożeniu
- Bez migracji bazy. Po wdrożeniu przejrzeć konsolę przeglądarki na podglądzie/produkcji (logowanie, odmiana, zdjęcie, raport, push); w razie blokad CSP ustawić `CSP_REPORT_ONLY=1`. Nowe APK z workflow „Aplikacja Android”: po przeniesieniu na nowy telefon trzeba się zalogować ponownie.

## [0.35.0] - 2026-10
### Dodano
- „Moje obserwacje” (`/obserwacje`, z „Więcej” i dziennika objawów): średnie objawów w dniach z jedną odmianą, osobno dni z kilkoma odmianami i bez zużycia, sen zestawiany ze zużyciem z poprzedniego dnia, średnia od 5 dni, kolejność według liczby dni; zużycie w okresie w g i ml osobno; bez ocen skuteczności i zaleceń.
- Raport dla lekarza 2.0: tabela tydzień po tygodniu (objawy, zużycie i wykup w g/ml), recepty w okresie ze stanem na koniec okresu, objawy w dniach z odmianą, gotowe okresy 30/90 dni i „od ostatniej wizyty”, przycisk „Udostępnij / Zapisz PDF”, wydruk A4 (90 dni na 2 stronach).
- Zdjęcia odmian z wolnych licencji: podpis „Fot. autor, licencja (źródło)” pod zdjęciem i w podglądzie, przycisk admina „Dodaj zdjęcia z wolnych licencji” (tylko odmiany bez zdjęcia, tylko zweryfikowane zdjęcia konkretnej odmiany), zweryfikowany manifest `data/zdjecia.json`.
- Źródła w artykułach Wiedzy o terpenach, THC/CBD i certyfikacie COA.
### Zmieniono
- Wydruk zawsze na białym tle także w ciemnym motywie.
### Uwaga przy wdrożeniu
- Migracje addytywne: `strain_photos.credit`, `license`, `license_url`, `source_url`.

## [0.34.0] - 2026-10
### Dodano
- Podpowiedzi wyszukiwania od pierwszej litery na stronie /szukaj i na liście odmian: grupy (odmiany, producenci, terpeny i smaki, katalog, Wiedza, grupy, osoby od 2 znaków), dopasowanie bez polskich znaków („zolw” → „Żółw”), wyróżnienie dopasowania, ostatnie wyszukiwania (bez zapisu w trybie dyskretnym), obsługa klawiatury i czytnika ekranu (ARIA combobox).
- Jednostki: olej i pen w ml, susz w g - karta odmiany, szybkie akcje i „Cofnij”, panel „Dziś” (osobny zapas g i ml, przełącznik wykresu), Historia i korekty, statystyki odmiany, raport z osobnymi sumami, recepty z wyborem jednostki, push, eksport i CSV (kolumna „Jednostka”). Podpowiedź postaci „Olej” dla nazw „Extractum …”.
### Zmieniono
- Pula „do wykupienia” łączy tylko odmiany tej samej postaci; wykup na recepcie liczony z zakupów tej samej jednostki.
- Znacznik „Kończy się”, próg i miesięczny limit dotyczą suszu.
### Uwaga przy wdrożeniu
- Migracje addytywne: funkcje `form_unit`, `strain_unit`, `pool_key(…, form)` (stara wersja zostaje), `prescriptions.unit` (domyślnie 'g'); pule olejów i penów kopiowane jednorazowo pod nowe klucze. Jeśli między pierwszym podglądem a wdrożeniem ktoś zmienił „do wykupienia” oleju lub pena, uruchom SQL z sekcji 6 `docs/HANDOFF.md`.

## [0.33.0] - 2026-10
### Dodano
- Korekta wpisów w Historii: „Popraw” i „Usuń” przy zużyciu i wykupie (gramy, data, cena za gram lub łączny koszt). Zmiana gramów przelicza zapas i pulę „do wykupienia”; zmiana daty nie zmienia stanu. Zakupy bez ceny są oznaczone, a po wpisaniu „Ceny u mnie” aplikacja proponuje uzupełnienie ich kosztu.
- „Cofnij” po szybkim zapisie zużycia i wykupu (8 s w aplikacji, do 10 min po stronie serwera) oraz ochrona przed podwójnym zapisem przy ponowieniu po zerwanym połączeniu (`requestId`).
- Szybki wpis objawów w panelu „Dziś”: ból, sen, lęk i nastrój jednym dotknięciem (0/3/5/7/10), bez nadpisywania notatki z dziennika.
- Katalog Zielnika (`data/odmiany.json`, 16 odmian z polskich aptek ze źródłami) i przycisk admina „Uzupełnij dane z katalogu Zielnika” (tylko puste pola: smak, terpeny, opis; w historii zmian jako „Zielnik (katalog)”).
- Wiedza: artykuły o kannabinoidach, waporyzacji, przechowywaniu, interakcjach z lekami i prawie pacjenta w Polsce, rozszerzony słowniczek, źródła przy artykułach.
- Agenci `innowacje` (lista pomysłów `docs/POMYSLY.md`) i `tresci` (dane odmian, zdjęcia na wolnych licencjach, Wiedza).
- Panel admina, zakładka System: „Zdjęcie z apteki → CSV”. Zdjęcie (aparat lub galeria, do 4 naraz) listy, półki albo cennika apteki odczytuje Claude API (`ANTHROPIC_API_KEY`, model `ZIELNIK_VISION_MODEL`, domyślnie `claude-opus-5-5`): nazwa rejestrowa, producent, odmiana, THC, CBD, postać, opakowanie, cena. Edytowalny podgląd z oznaczeniem „Niepewne”, usuwanie wierszy, „Pobierz CSV”, „Kopiuj CSV” i „Importuj do katalogu” (scalanie bez duplikatów po producencie i nazwie, bez oznaczania innych pozycji jako „Brak w źródle”). Oleje („Extractum…”) i wkłady mają opakowanie w ml. Zdjęcia nie są zapisywane.
- „Sprawdź dostępność w aptekach” (strona produktu na gdziepolek.pl albo wyszukiwanie w obrębie serwisu) na stronie odmiany i w katalogu, z neutralnym tekstem odnośnika; w Wiedzy nowa sekcja „Gdzie sprawdzić dostępność w aptekach”.
### Zmieniono
- Wykres objawów w dzienniku: linie odróżnialne kreską i kształtem punktu, tabela dla czytnika ekranu; opisy skal przy suwakach.
- „Dziś” w dzienniku, receptach i raporcie liczone w czasie polskim (wcześniej UTC: tuż po północy wpis trafiał pod wczoraj).
- `syncCatalog` ma tryb scalania (`merge`), a `POST /api/catalog` przyjmuje `mode: 'zdjecie'`. Testy z bazą wczytują JSON importowany bez atrybutu (hak `load` w `tests/db/loader.mjs`).
### Uwaga przy wdrożeniu
- Migracje addytywne: `usage_log.request_id`, `usage_log.stock_delta`, `purchases.request_id`, `purchases.pool_delta` (z unikalnymi indeksami), `strain_edits.actor`. Funkcja „Zdjęcie z apteki → CSV” wymaga `ANTHROPIC_API_KEY` w Vercel.

## [0.32.0] - 2026-10
### Dodano
- Panel „Dziś” na ekranie głównym: duży zapas z „starczy na N dni” i miernikiem, wykres zużycia z 14 dni, szybkie „Zużyłem” dla ostatnio używanej odmiany, karty recept z odliczaniem (pilne nad zapasem, wygasłe z resztą do 60 dni wstecz) zamiast ramki ostrzeżeń (`lib/stats.js`).
- Nowa strona szczegółów odmiany: zdjęcie na pełną szerokość albo blok w kolorze rodzaju, duże oceny (końcowa, średnia, moja), THC/CBD jako paski, terpeny jako chipy, „Moje statystyki” (wykupione, zużyte, średnio dziennie, ostatnie użycie) z wykresem tygodniowym z 12 tygodni (`lib/strain-stats.js`).
### Zmieniono
- „Wykupiłem” jest zawsze na karcie odmiany (także przy 0 g), przycisk „+” tylko na liście odmian.
- Opinie innych w szczegółach odmiany jako wiersze; karta charakterystyki w trybie zwartym bez powtórzeń z nagłówka.

## [0.31.0] - 2026-10
### Dodano
- Zdjęcia odmian i testów w prywatnym Vercel Blob (PLA-4, krok 1): gdy jest `BLOB_READ_WRITE_TOKEN` i `PHOTOS_BLOB=1` (opt-in), nowe zdjęcie trafia do `zielnik-photos/<losowy-uuid>.<rozszerzenie>` (`access: 'private'`), a w bazie zostaje tylko ścieżka w nowej kolumnie `blob_path` (`strain_photos`, `strain_tests`; `data = ''`). Odczyt dalej idzie przez trasy `/api/strains/[id]/photo` i `/api/tests/[tid]/photo` z tą samą kontrolą uprawnień (`can_see` dla testów) i prywatnym cache. Bez tokenu lub bez flagi działa jak dotąd (base64 w bazie); sam token (używany przez kopie) włącza tylko odczyt i usuwanie. Brak obiektu lub tokenu przy odczycie daje 404.
- Usunięcie lub podmiana zdjęcia, testu, odmiany (także przez admina i zgłoszenie) oraz konta usuwa obiekt z Blob (best effort, błąd tylko w logu).
- `scripts/photos-to-blob.js`: jednorazowa, idempotentna migracja istniejących zdjęć base64 do Blob, partiami, z trybem `--dry-run` (patrz `docs/ARCHITEKTURA.md`).
- Powiadomienia push do aplikacji natywnej przez Firebase Cloud Messaging (HTTP v1): `lib/fcm.js` (token OAuth z konta usługi w `FIREBASE_SERVICE_ACCOUNT`, podpis RS256, cache tokenu). Przypomnienia i powiadomienie testowe trafiają też na tokeny FCM, z neutralną treścią (do FCM zawsze bez szczegółów, bo przechodzi przez Google). Token z `UNREGISTERED`/404/`SENDER_ID_MISMATCH` jest usuwany; błędy konfiguracji i usługi (OAuth, 403, 429, 5xx, timeout) nie liczą się jako porażka tokenu, a nieudane OAuth jest pamiętane 60 s. Bez zmiennej wysyłka FCM jest wyłączona.
- ESLint 9 (`npm run lint`, `eslint.config.mjs`) z regułami `no-undef`, `no-unused-vars` i reguł hooków Reacta, uruchamiany w CI po `npm run check`; reguły React Compiler działają jako ostrzeżenia.
- System projektowy (`docs/DESIGN.md`): tokeny kolorów, typografii, odstępów i promieni w `app/globals.css` (jasny i ciemny motyw), jeden zestaw ikon SVG (`Icon.js`), style podzielone na pliki obszarów w `app/styles/`.
- Aplikacja Android wygląda natywnie: bez pasków przewijania i efektu przeciągnięcia przeglądarki, haptyka, odświeżanie przeciągnięciem, przejścia między ekranami, ekran startowy i ikona, ekran offline, obsługa klawiatury, ciasteczko sesji zapisywane przy zejściu do tła.
- Wspólny parser liczb (`app/components/num.js`) i format daty (`lib/date.js`) z testami.
### Zmieniono
- Eksport konta z `?photos=1` dołącza zdjęcia z Blob jako base64 (bez zmiany formatu). Kopia zapasowa: `strain_tests` zawiera teraz `blob_path` (ścieżka zamiast base64, jak dotąd bez `data`); `strain_photos` nadal nie jest w kopii.
- Cron przypomnień i test działają, gdy skonfigurowany jest Web Push albo FCM (wcześniej tylko VAPID); `/api/push/config` zwraca też `fcm` i `any`. W profilu w aplikacji przycisk testu pojawia się, gdy serwer ma Firebase.
- Nowy wygląd wszystkich ekranów: nawigacja, lista i karta odmiany, szczegóły, profil jako ustawienia, logowanie i rejestracja, katalog i wyszukiwanie, rankingi i koło, historia, raport, dziennik objawów, recepty, znajomi, grupy, profil publiczny, wiedza, premium, panel admina (zakładki, listy zamiast tabel), ekrany błędu i 404.
- Na telefonie „Dodaj odmianę” jest pod przyciskiem „+”, a „Wyloguj” w menu „Więcej”; zwinięta karta to wiersz listy (nazwa, dane, ocena, szybkie akcje, stan), a pola ocen i stanów są po „Szczegóły”.
- Pola ilości, THC, CBD i cen przyjmują przecinek („0,5”) i pokazują klawiaturę dziesiętną; błędna liczba daje komunikat zamiast cichego zera.
- Cele dotykowe co najmniej 44 px, karta odmiany mieści się na ekranie 320 px, przycisk „+” nie zasłania końca strony szczegółów.
- Tryb dyskretny obejmuje też profil publiczny, grupy, raport (wydruk pokazuje nazwy), historię zmian odmiany i komunikaty katalogu.
### Naprawiono
- Przełączenie zakładki w panelu admina kasowało komunikat z hasłem tymczasowym po resecie konta.
- Aplikacja Android: przytrzymanie pola tekstowego nie pozwalało wkleić tekstu; nawigacja po kotwicy (#) zamrażała ekran na chwilę; podwójna wibracja przełączników; przerwane przeciąganie odświeżania mogło przeładować stronę.
- Build APK przerywał niepoprawny komentarz w `colors.xml`.
### Uwaga przy wdrożeniu
- Migracja addytywna: kolumna `blob_path` w `strain_photos` i `strain_tests` (pierwsze żądanie po wdrożeniu). Zdjęcia nadal w bazie, dopóki nie ustawisz `PHOTOS_BLOB=1`; migrację starych zdjęć (`scripts/photos-to-blob.js`) uruchom dopiero po kopii bazy, najpierw `--dry-run` i `--limit=5`.

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
