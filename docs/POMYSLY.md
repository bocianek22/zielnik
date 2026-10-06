# Pomysły na rozwój Zielnika

Lista prowadzona przez agenta „innowacje” (`.claude/agents/innowacje.md`). Stan na wersję **0.38.0** (0.33: Cofnij, szybki wpis objawów, czas polski; 0.34: podpowiedzi wyszukiwania i ml; 0.35: Moje obserwacje i raport 2.0; 0.36: zapisy offline, skróty APK; 0.37: sposób i pora, CSV, puste stany; 0.38: sesje i blokada PIN w PWA). W toku w 0.39.0: POM-07 i POM-23 (ich wierszy nie zmieniamy do wydania). Pierwsza runda: 2026-10-03, odświeżenie: 2026-10-04, bez implementacji.

Oznaczenia: **wartość** dla pacjenta 1-5 · **koszt** S (godziny) / M (dzień-dwa) / L (tydzień i więcej) · **ryzyko**: P prywatność / danych zdrowotnych, Pr prawo, T techniczne · **zależności**: 🌐 domena, ⚖️ prawnik, 💳 płatności, 📧 e-mail, 🔑 klucze w Vercel (VAPID/FCM), ⏱ cron co godzinę (`PUSH_CRON_HOURLY=1`, plan Vercel Pro, PLA-3). Identyfikatory `POM-xx` są nowe; przy pokrywaniu się z `ROADMAP.md` podano powiązany punkt i zawężenie.

Zasady oceny: odrzucamy wszystko, co jest poradą medyczną, sugeruje zwiększanie dawek, reklamuje produkty lecznicze lub apteki, albo ujawnia dane zdrowotne poza właściciela. „Jak zmierzyć” korzysta tylko z tego, co projekt ma: zbiorcze liczniki SQL w panelu admina (`StatsAdmin`, bez danych zdrowotnych konkretnych osób), `error_log`, Lighthouse (cele MOB: LCP < 2,5 s, INP < 200 ms, CLS < 0,1), testy w `tests/` i ręczna próba na telefonie. Nie dodajemy analityki zachowań.

## Rekomendacje na kolejne wydania (0.40.0-0.41.0)

Reguła wyboru: brak zależności od decyzji właściciela (🌐 ⚖️ 💳 📧 ani kluczy), koszt S lub M, domyka luki z przeglądów 0.35-0.38 i poprawia jakość zapisów, zanim dojdą kolejne funkcje. Kolejność = sugerowana kolejność wydań. Poprzednia pula (POM-01, 02, 04, 06, 09, część 21) jest zrobiona.

| # | Pomysł | Koszt | Uzasadnienie |
|---|---|---|---|
| 1 | **0.40.0 „Twarde podstawy”: POM-24 Lighthouse w CI + POM-34 trasy auth bez `safe()`/`requireUser()` + POM-33 „Zmień PIN”** | S + S + S | Trzy małe luki z przeglądów w jednym wydaniu. Lighthouse w CI zmierzy efekt POM-23 (lżejszy ekran główny) zamiast zgadywać. `change-password` to jedyna trasa chroniona sesją bez `requireUser()` i bez `safe()`. „Zmień PIN” dziś wymaga wyłączenia blokady i ustawienia od nowa, co zniechęca do jej używania. |
| 2 | **POM-38 „Dzień bez zużycia” jednym dotknięciem** | S/M | „Moje obserwacje” liczą „dni bez zużycia” od pierwszego zapisu, czyli brak wpisu uznają za brak użycia. Kto zapomni o wpisie, zawyża grupę porównawczą. Znacznik „dziś bez zużycia” rozdziela „nie wpisano” od „nie użyto”, poprawiając wiarygodność POM-06 i raportu. Bez nagradzania i bez serii. |
| 3 | **POM-37 Karta „Co zostało na recepcie”** (apteka, wizyta) | S/M | Pacjent w aptece pyta: ile jeszcze mogę wykupić i której odmiany. Dane są (recepty, pula „do wykupienia”, zapas), ale rozproszone po trzech ekranach. Jeden zwarty widok, bez cen i bez nazw aptek (POM-R4). |
| 4 | **0.41.0: POM-35 lekki indeks odmian i paginacja listy** (po POM-23) | M | Pełne `listStrains` ładują jeszcze `/wheel`, `/rankings` i `GET /api/strains`; przy kilkuset odmianach rośnie czas i transfer. Do podpowiedzi i wyborów wystarczy `strainIndex()` (id, nazwa, producent). Zamyka część PLA-5 po stronie serwera. |
| 5 | **0.41.0: POM-18 + POM-21/22 reszta**: „W dniach z tą odmianą” w szczegółach i porównaniu, suwaki i duże cele | S + S/M | Dokończenie POM-06 tam, gdzie pacjent wybiera odmianę, oraz zamknięcie UX-2 przed 1.0.0 (drżenie rąk, osoby starsze, TalkBack). |

Następne w kolejce (po spełnieniu zależności): POM-05 wieczorne przypomnienie o objawach (⏱ 🔑), POM-15 przypomnienie o wizycie (🔑), POM-36 „Do omówienia z lekarzem”.

## Tabela pomysłów

| ID | Pomysł | Wartość | Koszt | Ryzyko | Zależności | Status | ROADMAP |
|---|---|---|---|---|---|---|---|
| POM-01 | Dzień w czasie polskim w kliencie | 4 | S | T | – | zrobiony (0.33.0: dziennik, recepty, raport) | DT-5 |
| POM-02 | „Cofnij” po zapisie i idempotencja szybkich akcji | 4 | S/M | T | – | zrobiony (0.33.0: `requestId`, Cofnij 8 s / 10 min na serwerze) | HANDOFF 6.6 |
| POM-03 | Pora i sposób przyjęcia przy „Zużyłem” | 3 | M | P | – | zrobiony (0.37.0; bez „kiedy” - dzień poprawia Historia) | – |
| POM-04 | Szybki wpis objawów w panelu „Dziś” | 5 | M | P | – | zrobiony (0.33.0) | PAC-14 |
| POM-05 | Wieczorne przypomnienie o wpisie objawów | 4 | S | P | ⏱ 🔑 | nowy | PAC-9 |
| POM-06 | Moje obserwacje: objawy a odmiany | 5 | M | P, Pr | – | zrobiony (0.35.0, ekran `/obserwacje`; sekcja w szczegółach odmiany zostaje do POM-18) | PAC-7 (zawężenie) |
| POM-07 | Własne objawy i skale (np. VAS, nudności, apetyt) | 4 | M | P | – | nowy | PAC-14, PAC-6 |
| POM-08 | Nawyki bez presji: seria wpisów objawów | 3 | S | Pr | – | nowy | – |
| POM-09 | Raport dla lekarza 2.0 | 5 | M | P | – | zrobiony (0.35.0) | MON-4 (przedsionek) |
| POM-10 | Bezpieczne udostępnienie raportu lekarzowi linkiem | 4 | M | P, Pr | ⚖️ | nowy | MON-4 |
| POM-11 | Eksport CSV dziennika (objawy + zużycie) | 3 | S | P | – | zrobiony (0.37.0) | – |
| POM-12 | Skróty aplikacji w APK i głęboki link „Zużyłem” | 3 | S | P | – | zrobiony (0.36.0, APK 0.3.0) | MOB-14 (APK) |
| POM-13 | Widżet Androida „Zapas i Zużyłem” | 4 | L | P | – | nowy | MOB-16 |
| POM-14 | Zapisy offline z kolejką | 4 | M/L | P, T | POM-02 | zrobiony (0.36.0) | MOB-8 |
| POM-15 | Przypomnienie o wizycie i kontroli recepty | 4 | S | P | 🔑 | nowy | PAC-16 |
| POM-16 | Recepta: podział na pozycje i powiązanie zakupów | 3 | M | T | – | nowy | PAC-4 |
| POM-17 | Wyszukiwanie bez polskich znaków i w moich notatkach | 3 | S/M | P | – | częściowo (0.34.0: bez polskich znaków i podpowiedzi; brak grupy „Moje notatki”) | – |
| POM-18 | Porównanie z moimi statystykami i objawami | 3 | S | P | POM-06 | częściowo (0.44.0: statystyki; objawy przy odmianie dalej) | – |
| POM-19 | Kreator pierwszego uruchomienia | 4 | M | – | – | nowy | UX-6 |
| POM-20 | Puste stany prowadzące do pierwszego wpisu | 3 | S | – | – | zrobiony (0.37.0: Dziś, dziennik, recepty, Historia, raport) | UX-5 |
| POM-21 | Dostępność wykresów i formularzy | 4 | S/M | – | – | częściowo (0.33.0: wykres objawów kreska + kształt + tabela dla czytnika; zostają suwaki, kolory, axe) | UX-2 |
| POM-22 | Większy tekst i tryb „duże cele” | 3 | S | – | – | nowy | UX-2 |
| POM-23 | Wydajność ekranu głównego (dane „Dziś” bez pełnej listy) | 3 | M | T | – | nowy | PLA-5, MOB-9 |
| POM-24 | Budżety Lighthouse w CI | 3 | S | – | – | nowy (rekomendacja 0.40.0; zmierzy POM-23) | PLA-16, MOB-15 |
| POM-25 | Blokada PIN/biometrią także w PWA i automatyczne wylogowanie | 4 | M | P | – | zrobiony (0.38.0; zmiana PIN: POM-33) | KON-11 |
| POM-26 | Klucze dostępu (passkeys) | 3 | M | T | 🌐 | nowy | KON-9 |
| POM-27 | Lista sesji i urządzeń | 3 | M | T | – | zrobiony (0.38.0) | KON-4 |
| POM-28 | Szyfrowanie notatek i dziennika objawów w bazie | 4 | L | T | – | nowy | PRA-8 |
| POM-29 | Tryb opiekuna (wgląd tylko do odczytu) | 3 | L | P, Pr | ⚖️ | nowy | PAC-15 |
| POM-30 | Grupy: wspólne pytania i odpowiedzi bez ocen produktów | 2 | M | Pr | ⚖️ | nowy | SPO-8 |
| POM-31 | Alert powrotu odmiany do katalogu | 3 | M | Pr | ⚖️ | nowy | KAT-7 |
| POM-32 | Zgłoszenie „ta partia działała inaczej” | 3 | M | – | – | nowy | PAC-1, PAC-2 |
| POM-33 | „Zmień PIN” w blokadzie bez jej wyłączania | 3 | S | P | – | zrobiony (0.40.0) | KON-11 |
| POM-34 | Trasy auth w trybie `safe()` / `requireUser()` (`change-password`) | 2 | S | T | – | zrobiony (0.40.0) | – |
| POM-35 | Lekki indeks odmian i paginacja listy po stronie serwera | 3 | M | T | POM-23 | nowy | PLA-5 |
| POM-36 | „Do omówienia z lekarzem”: lista pytań przy raporcie | 3 | S | P | – | zrobiony (0.43.0) | MON-4 |
| POM-37 | Karta „Co zostało na recepcie” (apteka, wizyta) | 4 | S/M | P | – | zrobiony (0.42.0) | PAC-4 |
| POM-38 | „Dzień bez zużycia” i nadrabianie wpisów | 4 | S/M | P | – | zrobiony (0.41.0) | PAC-7 |
| POM-39 | Inne leki w raporcie dla lekarza (opcjonalna lista) | 3 | M | P, Pr | ⚖️ | nowy | PAC-5 |
| POM-R1 | Seria dni z użyciem / odznaki za zużycie | – | – | Pr | – | **odrzucony** | – |
| POM-R2 | Podpowiedź dawki („spróbuj 0,3 g”) | – | – | Pr | – | **odrzucony** | – |
| POM-R3 | „Inni z bólem wybierają X” (wnioski z danych społeczności) | – | – | P, Pr | – | **odrzucony** | MON-7 |
| POM-R4 | Linki do aptek, ceny i „kup teraz” w aplikacji | – | – | Pr | – | **odrzucony** | PRA-3 |

## Szczegóły

### Codzienny zapis

**POM-01 Dzień w czasie polskim w kliencie** (błąd, DT-5)
- Ekran / element: Dziennik objawów (`app/dziennik/SymptomsBoard.js`: `todayIso`, `max` pola daty, przycisk „Dziś”, oś wykresu), Recepty (`app/recepty/Prescriptions.js`: domyślna data wystawienia), Raport (`app/raport/page.js`: domyślny zakres „od/do”).
- Problem: `toISOString().slice(0, 10)` zwraca dzień UTC. Od północy do 1:00 (zima) lub 2:00 (lato) czasu polskiego „Dziś” w dzienniku zapisuje wpis pod wczorajszą datą, pole daty nie pozwala wybrać dzisiejszego dnia, a domyślny raport kończy się na wczoraj. Wieczorne wpisy objawów to typowy moment (przed snem), więc błąd trafia w realne użycie.
- Propozycja: jedna funkcja `todayPl()` / `isoPl(date)` w `lib/date.js` (formatowanie przez `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' })`), użyta we wszystkich trzech miejscach; serwer może podawać „dziś” w propsach (jak robi to panel „Dziś”). `RegisterSW.js`, `NativeShell.js` i `api/backup` używają tego samego wzorca, ale tylko jako klucza „raz dziennie” lub nazwy pliku, więc nie wymagają zmiany.
- Jak zmierzyć: test w `tests/date.test.js` z zegarem ustawionym na 23:30 UTC; ręcznie na telefonie po północy.

**POM-02 „Cofnij” po zapisie i idempotencja szybkich akcji**
- Ekran / element: `QuickActions.js` (karta odmiany i panel „Dziś”), trasy `/api/strains/[id]/usage` i `/purchase`.
- Problem: pomyłka „1” zamiast „0,1” wymaga dziś ręcznej korekty stanu i zostaje w `usage_log` (zawyża raport i średnie). Ponowienie żądania po zerwanym połączeniu może zapisać zużycie dwa razy (otwarty punkt w HANDOFF 6.6).
- Propozycja: klient generuje `requestId` (UUID) przy otwarciu panelu; kolumna `request_id` z unikalnym indeksem (`user_id, request_id`) w `usage_log` i `purchases` (addytywnie w `ensureDb`), powtórzony zapis zwraca pierwszy wynik. W komunikacie „Zapisano: −0,5 g” przycisk „Cofnij” przez 10 s (usuwa wpis i przywraca stan w jednym zapytaniu, tylko własny i tylko ostatni).
- Jak zmierzyć: test w `tests/db/usage.test.js` (dwa żądania z tym samym `requestId` = jeden wpis; cofnięcie przywraca stan); licznik cofnięć w `StatsAdmin` (zbiorczo).

**POM-03 Pora i sposób przyjęcia przy „Zużyłem”**
- Ekran / element: panel gramów w `QuickActions.js`.
- Problem: `usage_log` ma tylko gramy i czas zapisu. Wpis dodany rano „za wczoraj wieczór” ląduje w złym dniu, a pacjent i lekarz nie widzą, czy to waporyzacja, czy olej.
- Propozycja: opcjonalne, zwinięte pola „kiedy” (teraz / wcześniej dziś / wczoraj wieczorem) i „sposób” (waporyzator, olej, inne) z zapamiętaniem ostatniego wyboru; kolumny `taken_at`, `method` (addytywnie), eksport i kopia. Domyślnie nic się nie zmienia (jedno dotknięcie jak dziś).
- Jak zmierzyć: udział wpisów z `taken_at` ≠ czas zapisu (zbiorczo); ręcznie: zapis nie wydłuża się o kolejne dotknięcie.
- Stan: zrobione. Kolumny `usage_log.method` (waporyzator/olej/inne, domyślnie z postaci) i `period` (rano/w ciągu dnia/wieczorem/w nocy; NULL = z godziny zapisu przez `usage_period()`). Panel „Zużyłem”: zwinięte „Sposób i pora” (zapis nadal jednym dotknięciem), pola idą w treści także przez kolejkę offline. Korekta w Historii zmienia oba pola; Historia i eksport konta je pokazują, raport lekarski ma opisowe zliczenie wpisów wg pory i sposobu. Bez `taken_at` (dzień poprawia się w Historii) i bez zapamiętania ostatniego wyboru. CSV (`/api/export`) dotyczy odmian, nie zużycia, więc bez zmian (zużycie w CSV to POM-11). Testy: `tests/db/usage-method.test.js`.

**POM-04 Szybki wpis objawów w panelu „Dziś”** (PAC-14)
- Ekran / element: `TodayPanel.js`, nowa karta pod zapasem; dziennik `/dziennik`.
- Problem: wpis objawów wymaga przejścia do osobnego ekranu i ustawienia czterech suwaków, a suwak startuje z wartością 5, co zachęca do „przeklikania”. Bez regularnych wpisów raport i korelacje są puste.
- Propozycja: karta „Jak się dziś czujesz?” z czterema rzędami po 5 przycisków (0, 3, 5, 7, 10 albo emotikonowe stopnie z etykietami słownymi), zapis przez istniejące `PUT /api/symptoms` po każdym dotknięciu; po zapisie karta zwija się do „Zapisano: ból 3, sen 7… · Zmień”. Pełny formularz z notatką zostaje w dzienniku.
- Jak zmierzyć: liczba dni z wpisem na aktywnego użytkownika w tygodniu (zbiorczo w `StatsAdmin`), porównanie 4 tygodnie przed i po wydaniu.

**POM-05 Wieczorne przypomnienie o wpisie objawów** (PAC-9, ⏱ 🔑)
- Ekran / element: ustawienia push w profilu (`push_prefs`), `lib/push.js`.
- Problem: cron przypomnień chodzi raz dziennie o 7:00 UTC (`vercel.json`), a `notify_hour` działa tylko przy `PUSH_CRON_HOURLY=1`. Nie ma przypomnienia o dzienniku.
- Propozycja: opcja „Przypomnij o dzienniku o 21:00, jeśli dziś nie ma wpisu” (`notify_symptoms`, `symptoms_hour`), neutralna treść („Masz wpis do uzupełnienia”), dotknięcie otwiera `/?objawy=1` (POM-04). Wymaga crona co godzinę (plan Pro) albo drugiego crona wieczornego jako obejścia.
- Jak zmierzyć: odsetek przypomnień, po których w ciągu 2 h powstał wpis (zbiorczo, z `push_sent` i `symptom_log`).

**POM-07 Własne objawy i skale** (PAC-14, PAC-6)
- Ekran / element: dziennik objawów, tabela `symptom_log` (cztery stałe kolumny).
- Problem: pacjenci z różnymi wskazaniami (spastyczność, nudności, apetyt, migrena) nie mają gdzie zapisać swojego głównego objawu.
- Propozycja: do 3 własnych objawów (nazwa, kierunek „wyżej = lepiej/gorzej”) w nowej tabeli `symptom_custom` + `symptom_values`; prywatne, w eksporcie i kopii; wykres i raport traktują je jak wbudowane.
- Jak zmierzyć: liczba kont z co najmniej jednym własnym objawem (zbiorczo); test w `tests/db/symptoms.test.js`.

**POM-08 Nawyki bez presji**
- Ekran / element: karta objawów w panelu „Dziś”.
- Problem: brak informacji zwrotnej, że regularne wpisy mają sens.
- Propozycja: licznik „wpisy objawów: 5 z ostatnich 7 dni” i informacja, od ilu wpisów pojawią się obserwacje (POM-06). Tylko dla dziennika objawów, nigdy dla zużycia (patrz POM-R1); bez odznak i bez „zerwania serii”.
- Jak zmierzyć: jak POM-04.

### Wnioski z własnych danych

**POM-06 Moje obserwacje: objawy a odmiany** (PAC-7, zawężenie do wersji opisowej)
- Ekran / element: nowa sekcja w dzienniku objawów i w szczegółach odmiany („W dniach z tą odmianą”), `lib/strain-stats.js`.
- Problem: pacjent ma dane o zużyciu i objawach, ale nie widzi ich razem; wykres objawów pokazuje tylko słupki gramów bez nazw odmian.
- Propozycja: dla każdej odmiany i objawu opis: „W 12 dniach z odmianą X średni ból 3,1; w 9 dniach bez niej 4,6”. Zasady:
  - sen pyta o „ostatnią noc”, więc sen z dnia D porównujemy z zużyciem z dnia D-1 (pozostałe objawy: ten sam dzień);
  - dni z więcej niż jedną odmianą liczymy osobno („dni mieszane”) albo pomijamy, z informacją;
  - minimum 5 dni w każdej grupie, inaczej „za mało danych”;
  - tylko średnie i liczba dni, bez linii trendu dawka-objaw, bez „najlepsza odmiana”, bez zaleceń; stały dopisek „To zestawienie Twoich zapisów, nie ocena skuteczności. Zmiany leczenia omawiaj z lekarzem.”;
  - liczone na żądanie po stronie serwera tylko dla właściciela, nie trafia do profilu publicznego ani grup.
- Ryzyko: Pr (granica porady medycznej, wymaga przeglądu słownictwa przy PRA-3), P (dane wrażliwe, ale nie opuszczają konta).
- Jak zmierzyć: test w `tests/db/insights.test.js` na danych syntetycznych (przesunięcie snu, próg 5 dni, dni mieszane); liczba otwarć sekcji niepotrzebna, wystarczy ręczny przegląd tekstów.
- **Stan: zrobione** jako osobny ekran `/obserwacje` (arkusz „Więcej” > Dziennik, link pod dziennikiem objawów), obliczenia w `lib/observations.js`, testy w `tests/db/observations.test.js` (próg, sen z poprzedniego dnia, północ w czasie polskim, g/ml osobno, dni mieszane, tylko własne dane). Grupy rozłączne dla każdego objawu: wiersz na odmianę (dni z tylko tą odmianą), „Dni z kilkoma odmianami”, „Dni bez zużycia” (liczone od pierwszego zapisu zużycia). Poniżej 5 dni średnia nie opuszcza serwera. Kolejność wierszy według liczby dni, bez kolorów lepiej/gorzej; ilości tylko jako sumy w okresie w jednostce odmiany (bez ilości na dzień obok średniej). Nie zapisuje nowych danych, więc bez zmian w `can_see`, eksporcie i kopii. Zostaje: sekcja „W dniach z tą odmianą” w szczegółach odmiany (razem z POM-18) i przegląd słownictwa przy PRA-3.

**POM-18 Porównanie z moimi statystykami i objawami**
- Ekran / element: `app/compare/page.js`.
- Problem: porównanie pokazuje dane odmiany i oceny, ale nie to, co pacjent wie najlepiej: ile jej zużył, jak często, kiedy ostatnio, i (po POM-06) średnie objawów.
- Propozycja: wiersze „Zużyłem razem / średnio dziennie / ostatnie użycie” z `lib/strain-stats.js` i opcjonalnie „Średni sen po dniach z tą odmianą (n dni)”, z tymi samymi progami co POM-06.
- Jak zmierzyć: ręcznie na 320 px (3 kolumny), test funkcji formatującej.

### Lekarz i eksport

**POM-09 Raport dla lekarza 2.0**
- Ekran / element: `app/raport/page.js`.
- Problem: objawy to jedna średnia z okresu (lekarz nie zobaczy, czy jest lepiej, czy gorzej), brak recept i ich wykorzystania, brak powiązania objawów z odmianami, domyślny zakres liczony w UTC (POM-01).
- Propozycja: tabela tygodniowa (gramy, liczba dni z użyciem, średnie objawów w tym samym wierszu), sekcja „Recepty w okresie” (przepisano / wykupiono / niewykorzystane), przy odmianach „dni użycia” i średnie objawów w te dni (zasady POM-06), wybór gotowego okresu (30/90 dni, od ostatniej wizyty). Tekst o charakterze zestawienia zostaje. Funkcja dalej w planie Premium (`doctor_report`), decyzja o udostępnieniu darmowo należy do właściciela.
- Jak zmierzyć: wydruk do PDF na telefonie mieści się na 2 stronach A4 dla 90 dni; test zapytań w `tests/db/report.test.js`.
- Stan: zrobiony (czeka na wydanie). `lib/report.js` liczy tygodnie od poniedziałku w czasie polskim (zużycie i wykup osobno w g i ml, dni z użyciem, dni z wpisem i średnie objawów), recepty w okresie ze stanem na koniec okresu (wykup do daty „do”) oraz objawy w dniach z odmianą (sen z dnia następnego, dni mieszane liczone przy każdej odmianie, średnia od 5 dni z wpisem, kolejność po liczbie dni). Gotowe okresy 30/90 dni i „od ostatniej wizyty” (data tylko w `localStorage` urządzenia), przycisk „Udostępnij / Zapisz PDF” (`window.print`, tytuł strony = nazwa pliku). Wydruk A4 dla 90 dni: 2 strony (Chromium). Do ręcznej próby: drukowanie w APK (WebView może ignorować `window.print`).

**POM-10 Bezpieczne udostępnienie raportu lekarzowi** (MON-4, ⚖️)
- Ekran / element: raport, przycisk „Udostępnij lekarzowi”.
- Problem: dziś jedyna droga to PDF wysłany komunikatorem albo pokazanie telefonu.
- Propozycja: jednorazowy link z losowym tokenem, ważny 72 h, tylko do odczytu, z migawką raportu (nie żywe dane), z możliwością unieważnienia i dziennikiem otwarć widocznym dla pacjenta. Wymaga opinii prawnika (udostępnianie danych zdrowotnych, PRA-2).
- Jak zmierzyć: test wygasania i unieważnienia w `tests/db/`; liczba wygenerowanych linków (zbiorczo).

**POM-11 Eksport CSV dziennika**
- Ekran / element: profil, sekcja eksportu (`app/api/account/export` daje dziś JSON).
- Problem: JSON jest dla programisty; pacjent chce otworzyć dane w arkuszu albo przekazać je w innej aplikacji.
- Propozycja: „Pobierz CSV: dzień, gramy, odmiany, ból, sen, lęk, nastrój, notatka” z zakresem dat, przez istniejący `lib/csv.js`.
- Jak zmierzyć: test formatu (przecinek dziesiętny, średnik jako separator dla polskiego Excela).

### Recepty

**POM-15 Przypomnienie o wizycie i kontroli recepty** (PAC-16, 🔑)
- Ekran / element: Recepty, nowe pole „Następna wizyta”.
- Problem: przypomnienia dotyczą końca ważności i zapasu, ale nie wizyty, a recepta wymaga wcześniejszej konsultacji.
- Propozycja: data wizyty przy recepcie lub osobno; push 3 dni i 1 dzień przed, neutralna treść; przy okazji progi przypomnień o recepcie 7/3/1/0 zamiast codziennie przez 8 dni (punkt z przeglądu 0.30.0).
- Jak zmierzyć: test w `tests/db/push.test.js` (wybór dni wysyłki); liczba powiadomień na użytkownika na tydzień spada.

**POM-16 Recepta: pozycje i powiązanie zakupów** (PAC-4)
- Ekran / element: Recepty, „Wykupiłem”.
- Problem: wykup liczony jest z wszystkich zakupów w okresie ważności, więc dwie nakładające się recepty liczą te same gramy.
- Propozycja: przy „Wykupiłem” wybór recepty (domyślnie najbliższa wygaśnięcia z pozostałymi gramami); kolumna `prescription_id` w `purchases`, stary szacunek jako rezerwa dla zakupów bez powiązania.
- Jak zmierzyć: test nakładających się recept w `tests/db/`.

### Aplikacja na telefonie

**POM-12 Skróty w APK i głęboki link „Zużyłem”**
- Ekran / element: `app/manifest.js` (skróty działają tylko w PWA), `mobile/android` (brak `shortcuts.xml`).
- Problem: w aplikacji z APK przytrzymanie ikony nie pokazuje skrótów; nie ma adresu, który otwiera od razu „Zużyłem” (jest tylko `/?new=1`).
- Propozycja: `/?zuzylem=1` otwiera panel gramów dla ostatnio używanej odmiany w panelu „Dziś”; statyczne skróty Androida (`shortcuts.xml`) do zużycia, objawów i recept. Etykiet skrótów nie da się przełączać razem z trybem dyskretnym, więc od początku są neutralne („Szybki wpis”, „Dziennik”, „Notatki”).
- Zrobione (APK 0.3.0): `/?zuzylem=1` otwiera „Zużyłem” ostatnio używanej odmiany z zapasem (bez takiej odmiany zwykła strona główna), `/#objawy` przewija do karty objawów; statyczne skróty `mobile/android/app/src/main/res/xml/shortcuts.xml` z neutralnymi etykietami „Zapisz”, „Samopoczucie”, „Raport” (zamiast recept raport dla lekarza). Ścieżkę otwiera `MainActivity` pod adresem `server.url`. Logika w `lib/shortcuts.js`, testy `tests/shortcuts.test.js`. Do zmierzenia ręcznie na telefonie.
- Jak zmierzyć: ręcznie na telefonie (przytrzymanie ikony, czas od ikony do zapisu < 5 s).

**POM-13 Widżet Androida „Zapas i Zużyłem”** (MOB-16)
- Ekran / element: ekran główny telefonu.
- Problem: najczęstsza czynność (zapis zużycia) wymaga otwarcia aplikacji, zalogowanej sesji i przewinięcia.
- Propozycja: natywny widżet (Kotlin, Glance) pokazujący „Starczy na N dni” i przycisk otwierający POM-12; dane z lekkiego `GET /api/today` z tokenem urządzenia. Domyślnie treść neutralna (bez nazw odmian i bez słowa „konopie”), szczegóły tylko po włączeniu; respektuje blokadę biometrią (dotknięcie otwiera aplikację z blokadą).
- Ryzyko: P (dane na ekranie głównym), T (kod natywny, utrzymanie).
- Jak zmierzyć: ręcznie; odsetek zapisów z widżetu (parametr w adresie, zbiorczo).

**POM-14 Zapisy offline z kolejką** (MOB-8, po POM-02)
- Ekran / element: `QuickActions.js`, dziennik objawów, `public/sw.js`.
- Problem: w aptece, piwnicy czy pociągu zapis kończy się błędem i znika. Service worker celowo nie cache'uje `/api/`.
- Propozycja: kolejka w IndexedDB tylko dla zapisów „Zużyłem”, „Wykupiłem” i objawów (z `requestId` z POM-02, `taken_at` z POM-03), wysyłana po odzyskaniu sieci; licznik „1 zapis czeka na sieć”. Nie przechowujemy offline odczytów danych (świadoma decyzja). Kolejka czyszczona przy wylogowaniu; w trybie dyskretnym bez nazw w komunikacie.
- Ryzyko: P (dane zdrowotne na urządzeniu do czasu wysłania), T (konflikty stanu).
- Jak zmierzyć: test ręczny w trybie samolotowym; `error_log` bez duplikatów.
- Stan: zrobione. Logika kolejki w `lib/offline-queue.js` (testy `tests/offline-queue.test.js`), przeglądarka w `lib/offline-client.js` (IndexedDB, limit czasu 10 s, Web Locks między kartami), licznik i panel w nagłówku (`OfflineQueue.js`). Do kolejki trafia zapis przy `navigator.onLine === false`, błędzie sieci albo przekroczonym czasie, a także gdy coś już czeka (kolejność). Wysyłka: start strony, `online`, powrót do karty, ponowienia 5 s → 5 min przy 5xx/408/429; 401/403 czeka na zalogowanie (nic nie kasuje); inne 4xx (w tym 409 „inne konto”) odrzuca z komunikatem i cofa stan. Serwer: opcjonalne `at` (czas z telefonu, najwyżej 72 h wstecz) dla zużycia i wykupu oraz `userId` → 409 przy zmianie konta (`tests/db/offline.test.js`). Kolejka czyszczona przy wylogowaniu (z pytaniem, gdy coś czeka), usunięciu konta i przy starcie innego konta. Service worker bez zmian (Background Sync nie działa w Safari/Firefoksie, a w APK SW jest wyrejestrowany).

### Wyszukiwanie i nawigacja

**POM-17 Wyszukiwanie bez polskich znaków i w moich notatkach**
- Ekran / element: `app/szukaj/page.js`, wyszukiwarka listy w `StrainsBoard.js`.
- Problem: `ILIKE` bez `unaccent`, więc „zolty” nie znajduje „Żółty”; `/szukaj` nie przeszukuje własnych notatek (odczucia, objawy, recepty).
- Propozycja: normalizacja po obu stronach (rozszerzenie `unaccent` albo funkcja `translate` dla polskich znaków w SQL i `normalize('NFD')` w JS); nowa grupa „Moje notatki” (tylko `user_id = me`).
- Jak zmierzyć: test w `tests/db/search.test.js` („zolty”, notatki innej osoby nie wracają).

### Pierwsze uruchomienie

**POM-19 Kreator pierwszego uruchomienia** (UX-6)
- Ekran / element: ekran główny po rejestracji.
- Problem: nowy użytkownik widzi pusty panel „Dziś” i listę; nie wie, że zapas, recepta i objawy razem dają prognozę i raport.
- Propozycja: trzy kroki do pominięcia: 1) dodaj odmianę, którą masz (podpowiedź z katalogu) i jej stan, 2) dodaj receptę, 3) włącz przypomnienia i tryb dyskretny. Na końcu „Twój panel Dziś” z wypełnionymi danymi.
- Jak zmierzyć: odsetek nowych kont z odmianą, receptą i co najmniej jednym zużyciem w 7 dni (zbiorczo).

**POM-20 Puste stany prowadzące do pierwszego wpisu** (UX-5)
- Ekran / element: panel „Dziś” (brak zapasu), wykres objawów (brak wpisów), raport (brak danych).
- Problem: część pustych stanów to sam tekst bez akcji; wykres objawów rysuje pustą siatkę.
- Propozycja: każdy pusty stan z jedną akcją („Dodaj pierwszy wpis”, „Wpisz stan”), zgodnie z zasadą 6 w `docs/DESIGN.md`.
- Jak zmierzyć: przegląd ekranów na nowym koncie.

### Dostępność

**POM-21 Dostępność wykresów i formularzy** (UX-2)
- Ekran / element: wykres w `SymptomsBoard.js`, suwaki objawów, wykres tygodniowy w szczegółach odmiany.
- Problem: cztery linie objawów różnią się tylko kolorem; brak listy danych dla czytnika ekranu (wykres w panelu „Dziś” ma `sr-only`); suwak z wartością 5 przy „nie wpisano” jest mylący dla czytnika mimo `aria-valuetext`.
- Propozycja: różne kształty punktów lub kreskowanie linii, etykiety na końcach linii, tabela danych `sr-only` (jak w `UsageChart`), przełącznik „pokaż jeden objaw”; zamiast suwaka przyciski z POM-04.
- Jak zmierzyć: TalkBack na telefonie, axe w przeglądarce (0 błędów krytycznych na `/dziennik` i `/`), symulacja daltonizmu.

**POM-22 Większy tekst i tryb „duże cele”**
- Ekran / element: profil (ustawienia wyglądu), tokeny w `app/globals.css`.
- Problem: część pacjentów to osoby starsze lub z drżeniem rąk (np. stwardnienie rozsiane); systemowe powiększenie czcionki w WebView nie zawsze działa.
- Propozycja: ustawienie „Większy tekst” (skala tokenów typografii) i „Większe przyciski” (cele 56 px), zapamiętane na urządzeniu jak motyw.
- Jak zmierzyć: ręcznie na 320 px przy skali 130%, brak poziomego przewijania.

### Wydajność

**POM-23 Lżejszy ekran główny** (PLA-5, MOB-9)
- Ekran / element: `app/page.js` (siedem zapytań, w tym pełne `listStrains`, przy każdym otwarciu).
- Problem: panel „Dziś” potrzebuje tylko zapasu, serii i recept, ale czeka na całą listę odmian z wpisami.
- Propozycja: panel „Dziś” renderowany od razu, lista odmian w `Suspense` (strumieniowanie) z paginacją po stronie serwera.
- Jak zmierzyć: Lighthouse mobilny na `/` (LCP < 2,5 s), czas odpowiedzi w logach Vercel przed i po.

**POM-24 Budżety Lighthouse w CI** (PLA-16, MOB-15)
- Ekran / element: `.github/workflows/ci.yml`.
- Problem: cele wydajności z MOB są zapisane, ale nikt ich nie sprawdza automatycznie.
- Propozycja: Lighthouse CI na podglądzie Vercel dla `/login` i `/` (konto testowe), budżet rozmiaru JS.
- Jak zmierzyć: raport w CI przy każdym PR.

### Bezpieczeństwo i prywatność

**POM-25 Blokada PIN/biometrią w PWA i automatyczne wylogowanie** (KON-11)
- Ekran / element: aplikacja w przeglądarce (blokada działa tylko w APK).
- Problem: sesja trwa 30 dni; na wspólnym komputerze lub telefonie bez APK dane zdrowotne są otwarte.
- Propozycja: opcjonalna blokada WebAuthn (biometria platformy) po N minutach bezczynności, bez wylogowania; „wyloguj po 7 dniach bez użycia” jako ustawienie konta.
- Jak zmierzyć: ręcznie (Android Chrome, iOS Safari); test wygaśnięcia sesji.
- Stan: zrobione w przeglądarce/PWA (`lib/applock.js`, `app/components/WebLock.js`, sekcja „Blokada i bezpieczeństwo” w profilu). PIN 4-8 cyfr tylko jako skrót PBKDF2 w `localStorage`, opóźnienia od 3. błędu, wylogowanie po 10; blokada po 1/5/15 min poza kartą i przy starcie; odcisk/twarz (WebAuthn platformowy) tylko lokalnie, bez weryfikacji podpisu, więc to wygoda, nie dowód tożsamości; wylogowanie po bezczynności wyłączone/1 h/8 h/24 h (ustawienie urządzenia, nie konta). W APK zostaje blokada natywna.

**POM-26 Klucze dostępu (passkeys)** (KON-9, 🌐)
- Problem / propozycja: hasło to jedyny czynnik; passkeys wymagają stabilnej domeny (RP ID), dlatego po zakupie domeny. Najpierw jako drugi sposób logowania, potem zamiennik TOTP (KON-5).
- Jak zmierzyć: liczba kont z kluczem (zbiorczo).

**POM-27 Lista sesji i urządzeń** (KON-4)
- Ekran / element: profil, obok „Wyloguj ze wszystkich urządzeń”.
- Propozycja: tabela sesji (urządzenie z User-Agent, ostatnie użycie, przybliżony kraj bez IP), wylogowanie pojedynczej; wymaga identyfikatora sesji w JWT i tabeli `sessions`.
- Jak zmierzyć: test w `tests/db/security.test.js`.
- Stan: zrobione. Tabela `sessions` (losowe `sid` w JWT, opis urządzenia z User-Agent, kraj z `x-vercel-ip-country`, bez IP), lista „Zalogowane urządzenia” w profilu (`app/profil/Sessions.js`, `GET/DELETE /api/account/sessions`, `DELETE /api/account/sessions/[id]`), tokeny sprzed `sid` przyjmowane do wygaśnięcia i dopisywane do listy. Testy w `tests/db/sessions.test.js`, opis w `docs/BEZPIECZENSTWO.md` (#26).

**POM-28 Szyfrowanie notatek i dziennika w bazie** (PRA-8)
- Problem: notatki, objawy i opinie są w bazie jawnym tekstem; kopie są szyfrowane, baza nie.
- Propozycja: szyfrowanie na poziomie aplikacji (AES-GCM, klucz w zmiennej środowiskowej) dla `symptom_log.note`, `user_strain.notes`, `prescriptions.note`; wyszukiwanie w notatkach (POM-17) wtedy tylko po stronie klienta.
- Jak zmierzyć: test, że w bazie nie ma jawnego tekstu; skrypt migracji z `--dry-run`.

### Społeczność i treści

**POM-29 Tryb opiekuna** (PAC-15, ⚖️)
- Propozycja: zaproszenie bliskiej osoby z dostępem tylko do odczytu do wybranych sekcji (zapas, recepty, bez notatek), z dziennikiem dostępu i odwołaniem jednym przyciskiem. Wymaga oceny prawnej (dane zdrowotne osoby trzeciej).
- Jak zmierzyć: testy uprawnień w `tests/db/` przez `can_see`.

**POM-30 Grupy: pytania i odpowiedzi bez ocen produktów** (SPO-8, ⚖️)
- Propozycja: wątki w grupach o praktyce (waporyzatory, rozmowa z lekarzem, apteki ogólnie), z moderacją i filtrem nazw odmian w tytułach, żeby nie tworzyć treści o charakterze reklamy (PRA-3).
- Jak zmierzyć: liczba zgłoszeń na 100 wpisów.

**POM-31 Alert powrotu odmiany do katalogu** (KAT-7, ⚖️)
- Propozycja: „Powiadom, gdy odmiana wróci do katalogu” przy odmianie z listy życzeń; tylko informacja o dostępności w katalogu, bez cen i bez nazw aptek. Do sprawdzenia przez prawnika w ramach PRA-3.
- Jak zmierzyć: liczba aktywnych obserwacji (zbiorczo).

**POM-32 Zgłoszenie „ta partia działała inaczej”** (PAC-1, PAC-2)
- Ekran / element: szczegóły odmiany, przy „Moje statystyki”.
- Problem: ta sama nazwa może mieć różne partie; pacjent nie ma gdzie zapisać, że nowa paczka różni się od poprzedniej.
- Propozycja: przy „Wykupiłem” opcjonalny numer serii; w szczegółach odmiany notatka per seria i (po POM-06) objawy per seria. Prywatne.
- Jak zmierzyć: liczba zakupów z numerem serii (zbiorczo).

### Luki z przeglądów 0.35-0.38 i nowe potrzeby (runda 2026-10-04)

**POM-33 „Zmień PIN” w blokadzie** (KON-11)
- Ekran / element: profil, „Blokada i bezpieczeństwo” (`app/profil/WebLockSettings.js`, `lib/applock.js`).
- Problem: PIN można tylko włączyć i wyłączyć. Żeby zmienić cyfry, trzeba wyłączyć blokadę (przy okazji przepada zgoda na odcisk/twarz) i zaczynać od nowa; wielu użytkowników zostaje przy PIN-ie, który widział ktoś obok.
- Propozycja: przycisk „Zmień PIN”: stary PIN (z istniejącymi opóźnieniami po błędach), nowy dwa razy, nowy skrót PBKDF2 z nową solą; ustawienia (czas blokady, odcisk) zostają. Po 10 błędach starego PIN-u to samo wylogowanie co przy odblokowaniu.
- Jak zmierzyć: test w `tests/applock.test.js` (stary PIN odrzucony po zmianie, licznik błędów wspólny z odblokowaniem); ręcznie na telefonie.

**POM-34 Trasy auth w trybie `safe()` / `requireUser()`** (dług)
- Ekran / element: `app/api/auth/change-password/route.js`; trasy bez `safe()`: `login`, `register`, `client-error`, `version`.
- Problem: reguła z `CLAUDE.md` (`safe()` + `requireUser()`) nie jest spełniona w trasie zmiany hasła: własny `try`, ręczne `getUser()`, własna odpowiedź 401. Trasy publiczne mogą zostać bez `requireUser()`, ale powinny mieć `safe()` albo jawny wyjątek na liście.
- Propozycja: przepisać `change-password` na `safe()` + `requireUser()` bez zmiany zachowania (limit prób, `revokeOtherSessions`, komunikaty); do `scripts/check.js` dodać kontrolę „każdy `route.js` używa `safe(` albo jest na liście wyjątków publicznych”.
- Jak zmierzyć: `npm run check` zawodzi dla nowej trasy bez `safe`; istniejące testy zmiany hasła w `tests/db/` przechodzą bez zmian.

**POM-35 Lekki indeks odmian i paginacja listy** (PLA-5, po POM-23)
- Ekran / element: `lib/strains.js` (`listStrains`), `/wheel`, `/rankings`, `GET /api/strains`, podpowiedzi i wybór odmiany w formularzach.
- Problem: pełna lista z wpisami użytkownika jest ładowana tam, gdzie potrzebna jest nazwa, producent i identyfikator. Przy kilkuset odmianach rośnie czas zapytania, transfer i zużycie pamięci WebView. `strainIndex()` już istnieje (szczegóły odmiany), ale nie jest używany szerzej.
- Propozycja: `strainIndex()` (z `ids` i filtrem) jako źródło podpowiedzi i wyborów; lista na `/` stronicowana kursorem (`created_at, id`), „Pokaż więcej” zamiast pełnego ładowania; filtr i wyszukiwarka po stronie serwera przy dużej liście. Widoczność dalej przez `can_see`.
- Ryzyko: T (regresje filtrów i sortowania po stronie klienta).
- Jak zmierzyć: Lighthouse (POM-24) na koncie z 300 odmianami, czas odpowiedzi `/` w logach Vercel; test w `tests/db/strains-index.test.js` (kursor, brak odmian niewidocznych).

**POM-36 „Do omówienia z lekarzem”** (MON-4)
- Ekran / element: raport (`app/raport/page.js`), blok na górze.
- Problem: przed wizytą pacjent pamięta pytania (zmiana postaci, skutki uboczne, przedłużenie recepty) i zapisuje je w notatkach telefonu poza aplikacją.
- Propozycja: do 10 krótkich punktów zapisanych w koncie (nowa tabela, `user_id`, tekst do 200 znaków), drukowanych w raporcie pod zestawieniem; punkt można odhaczyć po wizycie. Dane własne: `can_see`, eksport konta, kopia.
- Jak zmierzyć: test w `tests/db/report.test.js` (cudzy punkt nie pojawia się, limit 10); wydruk dalej na 2 stronach A4.

**POM-37 Karta „Co zostało na recepcie”** (PAC-4)
- Ekran / element: Recepty lub kafelek w panelu „Dziś” (`app/recepty/Prescriptions.js`, `lib/strain-stats.js`).
- Problem: odpowiedź na „ile jeszcze mogę wykupić i której odmiany” wymaga zajrzenia do Recept, puli „do wykupienia” i zapasu. W aptece liczy się szybkość, a widok recept to długa lista z historią.
- Propozycja: zwarta karta: aktywne recepty (ważne do, pozostało g/ml osobno), pula „do wykupienia” po odmianach (zasady jak dziś), przycisk „Wykupiłem”; tryb dyskretny rozmywa nazwy. Bez cen, bez linków do aptek i bez porównań (POM-R4).
- Jak zmierzyć: ręcznie na 390 px (cały widok bez przewijania przy 3 receptach); test funkcji składającej dane przy nakładających się receptach (POM-16).

**POM-38 „Dzień bez zużycia” i nadrabianie wpisów** (PAC-7)
- Ekran / element: panel „Dziś” (obok „Zużyłem”), Historia, `lib/observations.js`.
- Problem: „Moje obserwacje” i raport traktują dzień bez wpisu jako dzień bez użycia (grupa „Dni bez zużycia” od pierwszego zapisu). Zapomniany wpis zawyża tę grupę i zniekształca porównanie, a pacjent nie może powiedzieć „tego dnia na pewno nic nie użyłem” ani „nie pamiętam”.
- Propozycja: przycisk „Dziś bez zużycia” (znacznik dnia, bez gramów); w Historii podpowiedź „brak wpisów w 3 ostatnich dniach: dodaj albo oznacz jako bez zużycia”. W obserwacjach grupa „bez zużycia” liczy dni potwierdzone, reszta to „bez wpisów”. Bez serii, odznak i przypomnień zachęcających do zużycia (POM-R1); komunikaty neutralne.
- Ryzyko: P (nowa tabela `day_marks`: `can_see`, eksport, kopia, usuwanie konta), Pr (nie sugerować, że „bez zużycia” jest celem).
- Jak zmierzyć: test w `tests/db/observations.test.js` (dzień potwierdzony vs brak wpisu, północ w czasie polskim); zbiorczo: odsetek dni z wpisem lub znacznikiem w ostatnich 14 dniach aktywnych kont.

**POM-39 Inne leki w raporcie dla lekarza** (PAC-5, ⚖️)
- Ekran / element: profil lub raport, opcjonalna sekcja „Moje inne leki”.
- Problem: lekarz pyta o inne leki i interakcje; pacjent wymienia je z pamięci, a w Wiedzy jest artykuł o interakcjach bez miejsca na własną listę.
- Propozycja: lista nazw (tekst wolny do 100 znaków), drukowana w raporcie tylko po zaznaczeniu „dołącz”. Aplikacja niczego nie ocenia i nie ostrzega o interakcjach (to porada medyczna).
- Ryzyko: P (dane zdrowotne), Pr (granica porady medycznej, przegląd przy PRA-3).
- Jak zmierzyć: test w `tests/db/report.test.js` (tylko własna lista, domyślnie niedołączana); przegląd tekstów.

## Odrzucone

- **POM-R1 Seria dni z użyciem, odznaki za zużycie.** Nagradzałoby przyjmowanie leku, a nie obserwację; sprzeczne z zasadą niezachęcania do zwiększania dawek. Dopuszczalna jest tylko łagodna informacja o regularności wpisów objawów (POM-08).
- **POM-R2 Podpowiedź dawki.** Porada medyczna; dawkowanie ustala lekarz. Szybkie wartości w „Zużyłem” (0,1-1 g) zostają jako skrót klawiatury, bez sugestii.
- **POM-R3 Wnioski z danych społeczności („inni z bólem wybierają X”).** Łączy dane zdrowotne wielu osób, tworzy przekaz o skuteczności konkretnych produktów leczniczych (ryzyko reklamy, PRA-3) i wymaga zgody na badania (MON-7). Wnioski tylko z własnych danych (POM-06).
- **POM-R4 Linki do aptek, ceny i „kup teraz”.** Ryzyko reklamy aptek i produktów leczniczych; aplikacja natywna już ukrywa ceny (`isNativeApp`). Do ponownej oceny tylko po opinii prawnika (PRA-3).
