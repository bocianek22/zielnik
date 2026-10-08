# Plan do 31 października 2026: aplikacja kompletna przed publicznym startem

Cel właściciela (8.10): „jak najbardziej kompletna do końca miesiąca”, duże zmiany, praca agentów. Punkt odniesienia: lista kontrolna 1.0.0 w `ROADMAP.md` oraz otwarte pozycje P1/P2. Zasady pracy: `docs/AGENCI.md` (najwyżej 2 agentów budujących naraz, Sonnet do implementacji, Opus do projektu trudnych rzeczy i przeglądu przed każdym PR, koordynator scala i testuje styki).

## Budżet
- Limit tygodniowy agentów Sonnet skończył się 6.10 po ok. 2,5 dnia pracy; odnowienie 7.10 01:00 UTC, kolejne prawdopodobnie co tydzień (sprawdzać w komunikacie limitu). Jedna fala = jedno okno tygodniowe, duże zadania zaraz po odnowieniu.
- Każde zlecenie: commit WIP po każdym etapie (przy błędzie limitu nic nie przepada), raport ≤25 linii.
- `lib/db.js`: nowe tabele na końcu `init()`; konflikty rozwiązuje koordynator.

## Fale

| Fala | Termin | Agent A | Agent B | Dodatkowo |
|---|---|---|---|---|
| 1 | 8-13.10 | **POM-35 / PLA-5** lekki indeks odmian (`strainIndex`), paginacja i pamięć podręczna list, rankingów, koła, `GET /api/strains` (backend-db) | **Testy E2E na stałe** (`tests/e2e/`: logowanie, „Zużyłem”/„Wykupiłem”, objawy, blokada PIN, „Dziś bez zużycia”, „W aptece”, „Do omówienia”, tryb dyskretny) + job CI z lokalnym PostgreSQL + **POM-24 budżety Lighthouse** (frontend-mobile) | innowacje: odświeżenie `docs/POMYSLY.md` |
| 2 | 13-17.10 | **KAT-1** własność katalogu: propozycje zmian odmian i zatwierdzanie przez admina zamiast wspólnej edycji (backend-db + UI admina) | **UX-2 / POM-21 / POM-22** audyt dostępności WCAG 2.2 AA, tryb „duże cele”, większy tekst, kontrasty, TalkBack (frontend-mobile) | tresci: Wiedza i dane odmian |
| 3 | 17-22.10 | **KON-1** odzyskiwanie hasła e-mailem i weryfikacja adresu (za flagą, dostawca e-mail po kluczu) + **PLA-2** alerty błędów (security) | **POM-05 / POM-15** przypomnienia (objawy wieczorem, wizyta, kończąca się recepta) za flagami kluczy push i cron (backend-db) | |
| 4 | 22-27.10 | **PAC-4 / POM-16** recepta: pozycje i powiązanie zakupów z receptą (backend-db) | **POM-19 / UX-6** kreator pierwszego uruchomienia + **POM-13** widżet Androida i nowe APK (frontend-mobile) | |
| 5 | 27-31.10 | **POM-28** szyfrowanie tekstu (notatki, spostrzeżenia, „Do omówienia”) w bazie: najpierw projekt Opus (security), potem wdrożenie addytywne (nowa kolumna, odczyt z fallbackiem, przepisanie) | Przegląd 1.0: bezpieczeństwo (PLA-8, zależności), dostępność, wydajność (Lighthouse), lista kontrolna | Koordynator: APK, CHANGELOG, HANDOFF |

Kolejność może się przesunąć, gdy właściciel poda klucze (fala 3) albo zmieni priorytety.

## Zablokowane na właścicielu
| Pozycja | Czego potrzeba |
|---|---|
| KON-1 wysyłka e-maili | konto u dostawcy (np. Resend) i klucz w Vercel; kod powstanie za flagą |
| POM-05, POM-15 przypomnienia | klucze VAPID/FCM w Vercel; cron co godzinę wymaga Vercel Pro (PLA-3) |
| KON-3 logowanie Google | domena i klucze OAuth |
| PRA-1, PRA-2, PRA-3, KAT-4, POM-10, 29, 30, 31, 39 | prawnik (regulamin, DPIA, reklama produktów leczniczych) |
| MON-1 płatności | decyzja: start z płatnościami czy bez |
| PLA-3 | przejście na Vercel Pro |

## Stan
- 8.10: plan zapisany, fala 1 (POM-35, E2E, Lighthouse) wydana jako 0.45.0 (PR #17), job E2E w CI zielony za pierwszym razem. Fala 2 (KAT-1, UX-2) w toku.
- 8.10: fala 2 wydana jako 0.46.0 (PR #18, KAT-1 propozycje, UX-2 dostępność, naprawione podpowiedzi z internetu). Fala 3 (KON-1, PLA-2, POM-05/15) gotowa jako 0.47.0 po przeglądzie Opus i poprawkach; działa po podaniu kluczy przez właściciela.
- 8.10: 0.47.0 wydane (PR #19). Fala 4: POM-16 i POM-19/20 gotowe jako 0.48.0 po przeglądzie Opus; POM-13 zaprojektowany (`docs/WIDZET-ANDROID.md`, wariant bez nowego API), wdrożenie jako następne.
- 8.10: przygotowanie do bety wydane (0.49.0, 0.49.1; `docs/BETA.md`). Fala 5: POM-28 szyfrowanie notatek gotowe jako 0.50.0 (projekt Opus, przegląd Opus, poprawki), włączenie za kluczem przez właściciela. Zostaje przegląd 1.0.
- 8.10: przegląd 1.0 (`docs/PRZEGLAD-1.0.md`), poprawki po stronie kodu wydane jako 0.51.0. Plan fal 1-5 zrealizowany po stronie Claude; zostają decyzje i zadania właściciela.
