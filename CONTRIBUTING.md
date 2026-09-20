# Zasady pracy nad projektem

## Gałęzie i wdrożenia
- `main` jest wdrażana na produkcję (Vercel). Zmiany wprowadzamy przez krótkie gałęzie `feat/...`, `fix/...`, `docs/...` i Pull Requesty. Vercel tworzy dla nich adresy podglądu.
- Wgrywanie plików przez przeglądarkę też zapisuje commit. W polu „Commit changes” wpisuj opis w formacie poniżej zamiast domyślnego „Add files via upload”.

## Commity (Conventional Commits)
`typ(zakres): opis w czasie teraźniejszym`. Typy: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `security`.
Zakresy: `konta`, `prywatnosc`, `odmiany`, `pacjent`, `spolecznosc`, `katalog`, `wiedza`, `raporty`, `platforma`, `ui`, `admin`.
Przykłady: `feat(pacjent): dziennik objawów z wykresem`, `fix(odmiany): przywrócona funkcja dailyUse`.

## Wersjonowanie (SemVer)
- **PATCH** `0.15.1`: poprawka błędu bez nowych funkcji.
- **MINOR** `0.16.0`: nowa funkcja lub kompatybilna zmiana bazy. Do 1.0.0 także zmiany, które wcześniej byłyby MAJOR.
- **MAJOR** `2.0.0`: zmiana łamiąca zgodność (dane, API, zachowanie), po wydaniu 1.0.0.
- Wersja jest w `package.json`, opisana w `CHANGELOG.md` i widoczna w menu oraz pod `/api/version`.

## Migracje bazy
- Zmiany tylko addytywne i idempotentne (`IF NOT EXISTS`). Usuwanie lub zmiana typów wymaga planu, kopii i osobnego wpisu w `CHANGELOG.md`.
- Przed wdrożeniem większych zmian pobierz kopię zapasową (panel admina).

## Wydanie nowej wersji
1. Przenieś wpisy z `[Unreleased]` do nowej sekcji `## [x.y.z] - RRRR-MM-DD` w `CHANGELOG.md` i dopisz link na dole.
2. Zmień `version` w `package.json` (`npm run check` sprawdza zgodność z CHANGELOG).
3. Zmiany trafiają na `main`.
4. GitHub → zakładka **Actions** → **Wydanie** → **Run workflow**. Workflow tworzy znacznik `vX.Y.Z` i wydanie GitHub z notatkami z CHANGELOG.

## Poprawka błędu na produkcji (hotfix)
Gałąź `fix/...` z `main`, poprawka, podniesienie `PATCH`, wpis w CHANGELOG (sekcja „Naprawiono”), wydanie jak wyżej.

## Definicja ukończenia zmiany
- `npm run check` przechodzi.
- Zmiana ma wpis w `CHANGELOG.md`, a w razie potrzeby aktualizację `ROADMAP.md`.
- Nowe zapytania SQL i uprawnienia sprawdzone ręcznie na koncie testowym (zwłaszcza widoczność i prywatność danych).
- Dotyczy danych osobowych? Zaktualizuj eksport danych, kopię zapasową i politykę prywatności.

## Etykiety zgłoszeń
Typ: `typ:błąd`, `typ:funkcja`, `typ:dług`, `typ:dokumentacja`. Dział: `dział:konta`, `dział:prywatność`, `dział:pacjent`, `dział:społeczność`, `dział:katalog`, `dział:monetyzacja`, `dział:platforma`, `dział:ui`, `dział:admin`. Priorytet: `P0` do `P3` (zgodnie z `ROADMAP.md`).
