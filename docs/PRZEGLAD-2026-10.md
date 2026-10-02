# Przegląd projektu (październik 2026, wersja 0.28.2)

Pierwszy przegląd wykonany w środowisku z dostępem do sieci: po raz pierwszy uruchomiono `npm install`, pełny `next build`, ESLint (`no-undef`, reguły hooków React) oraz wszystkie zapytania SQL na prawdziwym PostgreSQL 16.

## 1. Co sprawdzono i z jakim wynikiem
| Kontrola | Wynik |
|---|---|
| `npm run check`, `npm test` | OK (146 plików, 11 testów) |
| `next build` (produkcyjny) | OK, wszystkie 70+ tras się kompilują, ~103 kB wspólnego JS |
| ESLint (`no-undef`, `react-hooks`) | 0 błędów, 1 ostrzeżenie (nieużywana zmienna `isPremium` w `app/premium/page.js`) |
| `ensureDb` na czystej bazie i ponownie | OK, idempotentne |
| `can_see`: tylko ja / znajomi / znajomi znajomych / wszyscy / blokada | OK, zgodnie z założeniami; stany i „do wykupienia” innych osób nigdy nie wychodzą |
| ~45 tras API jako 3-4 użytkowników i admin | 3 błędy (niżej, naprawione w 0.28.2) |
| Historia git (czy po wgraniach przez github.dev nic nie zginęło) | OK, wszystkie pliki z historii są obecne |

## 2. Błędy naprawione w 0.28.2
1. **Wyścig przy zużyciu i wykupie** (`usage`, `purchase`): stan był liczony w JS z wcześniej odczytanej wartości. 8 równoczesnych zapisów zużycia po 1 g z 10 g zostawiało 8 g zamiast 2 g. Teraz jedno zapytanie SQL z blokadą wiersza.
2. **Utrata cudzych danych przy usuwaniu odmiany:** `DELETE /api/strains/[id]` przez twórcę kasował kaskadowo oceny, opinie, testy i dziennik zużycia wszystkich osób. Teraz twórca usuwa tylko odmianę nieużywaną przez innych (409 w przeciwnym razie).
3. **Błędny identyfikator w adresie** (`/api/strains/abc`) dawał błąd SQL 500 i śmiecił w „Dzienniku błędów”. Teraz 404 (`intId` w `lib/guard.js`).
4. **„Wykupione w tym miesiącu”** liczone od początku miesiąca w UTC zamiast czasu polskiego.

Braki w repozytorium uzupełnione: `.gitignore`, `.env.example` (wymieniany w README), `package-lock.json`, `.github/workflows/ci.yml` i `release.yml` (dokumentacja opisywała CI i workflow „Wydanie”, ale w repozytorium ich nie było; wgrywanie przez przeglądarkę pomija ukryte foldery).

## 3. Znane problemy i ryzyka (do zaplanowania)
| # | Problem | Wpływ | Rozmiar | Propozycja |
|---|---|---|---|---|
| DT-11 | `ensureDb` wykonuje ok. 85 zapytań po kolei przy każdym zimnym starcie funkcji Vercel (lokalnie 160 ms, na Neon HTTP szacunkowo 1-3 s) | wolne pierwsze otwarcie aplikacji na telefonie | S | tabela `schema_meta` z sumą kontrolną treści `init()`; gdy zgodna, pominąć migracje (zostaje tylko synchronizacja hasła admina) |
| DT-12 | Edycja producenta/THC/CBD zmienia `pool_key`, więc „do wykupienia” wszystkich osób w tej puli wraca po cichu do 0 | błędne dane recepty | S-M | przy `PATCH` przenieść wiersze `user_pool` ze starego klucza na nowy (z sumowaniem) |
| DT-7 | Każdy zalogowany edytuje wspólne pola każdej odmiany | wandalizm, pomyłki | M | KAT-1: propozycje zmian + zatwierdzanie; do tego czasu historia zmian w `audit_log` |
| DT-13 | Sesja JWT ważna 30 dni bez możliwości unieważnienia; zmiana lub reset hasła nie wylogowuje innych urządzeń | przejęte konto zostaje przejęte | S | kolumna `session_version` w `users`, zapisywana w tokenie i sprawdzana w `getUser` |
| DT-14 | Limit 8 prób logowania / 15 min na nazwę użytkownika: każdy może zablokować logowanie dowolnej osoby (także admina) | odmowa usługi | S | blokada tylko dla pary IP+nazwa, a dla samej nazwy rosnące opóźnienie |
| — | Admin może usunąć odmianę razem z danymi wszystkich osób, bez ostrzeżenia | utrata danych | S | potwierdzenie z liczbą dotkniętych wpisów albo „miękkie” usuwanie / scalanie duplikatów |
| — | Trasy admina używają `getUser` zamiast `requireUser`: admin z wymuszoną zmianą hasła może korzystać z API admina | niskie | S | `requireAdmin()` w `lib/guard.js` |
| — | Zmiana hasła bez limitu prób i bez górnej granicy długości (bcrypt bierze tylko 72 bajty) | niskie | S | `hit()` jak przy logowaniu, maks. 100 znaków jak przy rejestracji |
| DT-4 / MOB-10 | Każda nowa odmiana tworzy wiersz `user_strain` dla każdego użytkownika (i odwrotnie przy rejestracji); `listStrains` pobiera wszystko | rośnie jak użytkownicy × odmiany | M-L | wiersze tylko przy pierwszym zapisie, lista z paginacją; sprawdzić w `tests/db/` na dużych danych |
| DT-6 | Import CSV: do ~1200 zapytań po kolei dla 200 wierszy | przekroczenie czasu funkcji | S | wstawianie wsadowe (`INSERT ... SELECT FROM unnest(...)`) |
| PLA-8 | Brak nagłówków bezpieczeństwa | średnie | S | `headers()` w `next.config.mjs`: `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`, HSTS; CSP osobno (skrypt motywu w `layout.js`) |
| DT-3, PLA-7 | Zdjęcia (base64) i kopie zapasowe w tej samej bazie | rozmiar bazy, brak kopii poza Neon | M | Vercel Blob na zdjęcia i kopie |

## 4. Proponowana kolejność prac
**Etap A: stabilność (bez domeny, 1-2 tygodnie)**
1. Scalić 0.28.2, włączyć ochronę gałęzi `main` z wymaganym CI, osobna gałąź bazy Neon dla podglądów Vercel (PLA-3).
2. DT-11 (szybki start), DT-13 + DT-14 + `requireAdmin` + PLA-8 (jedno wydanie „bezpieczeństwo”).
3. DT-12 (pule) z testem w `tests/db/`.

**Etap B: skala i jakość danych**
4. MOB-10 / PLA-5 / DT-4: lżejsza lista odmian, paginacja, koniec tworzenia wierszy dla wszystkich.
5. KAT-1: propozycje zmian katalogu (zamyka DT-7), historia edycji odmian w `audit_log` (ADM-1).
6. PLA-4 / PLA-7: zdjęcia i kopie poza bazą.

**Etap C: po decyzjach właściciela** (🌐 domena, ⚖️ prawnik, 💳 płatności)
7. KON-1, KON-3, PRA-1..3, MON-1, zgodnie z listą kontrolną 1.0.0 w `ROADMAP.md`.

## 5. Zmiana sposobu pracy
Dotychczasowy tryb (ZIP z rozmowy → ręczne wgrywanie folderów przez github.dev) był główną przyczyną incydentów z 0.19-0.24 (skasowane foldery, literówka `(s) =`, brakujące pliki) i powodem, dla którego SQL nigdy nie był uruchamiany przed wdrożeniem. Zalecenie: praca w Claude Code z podłączonym repozytorium, gałęzie i Pull Requesty, CI (`check`, `test`, `build`, `test:db`) oraz podgląd Vercel przed scaleniem do `main`.
