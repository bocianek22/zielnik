# Praca z agentami: oszczędność limitów przy zachowaniu jakości

Zasady dla koordynatora (główna sesja Claude Code) i dla agentów w `.claude/agents/`.

## 1. Model do zadania
| Zadanie | Model |
|---|---|
| Implementacja funkcji, poprawki, testy, dane, treści | Sonnet (domyślnie we wszystkich agentach poza reviewerem i security) |
| Projekt nowego ekranu od zera, trudny przegląd wyglądu, architektura (np. kolejka offline, uprawnienia) | Opus, tylko gdy koordynator wskaże to w zleceniu |
| Przegląd przed wydaniem (reviewer), bezpieczeństwo | Opus, raz na wydanie, na całym diffie, nie po każdym scaleniu |
| Proste zmiany (CHANGELOG, wersja, literówki, scalanie) | Koordynator sam, bez agenta |

## 2. Równoległość i okna limitu
- Najwyżej 2 agentów naraz. Trzeci tylko wtedy, gdy dotyka zupełnie innych plików i jest mały.
- Duże zadania startują zaraz po odnowieniu okna limitu, nie pod jego koniec.
- Agent przy błędzie limitu ma zacommitować WIP; koordynator wznawia go przez SendMessage (agent zachowuje kontekst), zamiast uruchamiać nowego.

## 3. Krótkie zlecenia
- Zlecenie odsyła do tego pliku, `CLAUDE.md` i `docs/POMYSLY.md` zamiast powtarzać zasady. Zawiera tylko: cel, pliki w zakresie, pliki zakazane (równoległe prace), kryteria gotowości.
- Raport końcowy agenta: najwyżej ~25 linii (zmiany, hash, wyniki kontroli, co sprawdzić na telefonie, decyzje do podjęcia). Bez opisu krok po kroku.

## 4. Testy i kontrole
- W trakcie pracy agent uruchamia tylko testy dotkniętego obszaru (`node --test tests/x.test.js`, pojedynczy plik `tests/db/...`). Pełne `npm run test:db` raz, przed commitem końcowym.
- Koordynator po scaleniu uruchamia pełny zestaw raz przed PR (nie po każdym scaleniu, jeśli agent podał zielony wynik na aktualnej bazie gałęzi i scalenie było bez konfliktów).
- CI na GitHubie jest ostatecznym sprawdzeniem; nie powtarzać ręcznie tego, co CI i tak zrobi, chyba że jest konflikt.

## 5. Zrzuty ekranu
- Wspólne narzędzia w repozytorium: `scripts/dev/` (budowanie z lokalnym PostgreSQL, start serwera na wybranym porcie, dane testowe, zrzuty). Agent ich używa zamiast pisać własne.
- Standardowy zestaw: 390 px jasny i ciemny dla zmienionych ekranów. 320 i 1280 px tylko dla nowych układów. Koordynator ogląda 1-2 kluczowe zrzuty, nie wszystkie.

## 6. Wydania
- Jedno wydanie = 1-3 zadania z jednego okna limitu. Jeden PR, jeden przegląd, jedno sprawdzenie produkcji.
- Sprawdzenie produkcji po wdrożeniu: jedno zaplanowane wywołanie (`send_later`), bez czekania w pętli.

## 7. Narzędzia (`scripts/dev/`)
Wspólne skrypty, żeby nie pisać własnych. Wymagają lokalnego PostgreSQL (`service postgresql start`, użytkownik `z`/`z`). PID, logi i zrzuty trafiają do `.dev/` i `zrzuty/` (w `.gitignore`).
```
scripts/dev/build-local.sh                       # build z aliasem Neon -> pg (ZIELNIK_LOCAL_PG=1), next.config.mjs bez zmian
scripts/dev/serve.sh 4400 devtools               # tworzy bazę, startuje next start w tle (PID: .dev/4400.pid, log: .dev/4400.log)
node scripts/dev/seed.mjs devtools --port 4400   # ania, bartek, admin Bocian; susz i olej (ml), 90 dni zużycia, recepty, zdjęcie, znajomi
node scripts/dev/shots.mjs --port 4400 --out zrzuty --pages /,/raport --widths 390 --themes light,dark [--discreet] [--login ania]
scripts/dev/stop.sh 4400                         # zatrzymuje tylko PID z .dev/4400.pid i czyści rate_limits
```
- Konta: `<login>-haslo-1` (`ania`, `bartek`, `Bocian`). Seed można powtarzać na tej samej bazie.
- Każdy agent używa własnego portu i własnej bazy (równolegle pracujące worktree nie mogą dzielić `.next/` ani bazy).
- `shots.mjs` kończy się kodem 1, gdy są błędy konsoli/CSP lub odpowiedzi >= 400.

### Testy E2E i budżety wydajności
Stałe testy w CI (job `e2e` w `.github/workflows/ci.yml`); lokalnie jedna komenda stawia wszystko sama: build z lokalnym PostgreSQL, serwer na wolnym porcie, świeża baza z `seed.mjs`, testy, stop i usunięcie bazy.
```
npm run test:e2e                       # tests/e2e/*.test.mjs (Playwright, Chromium, 390 px, node:test); ~1 min z buildem, ~20 s bez
npm run test:perf                      # Lighthouse (mobilnie) dla /login i / względem tests/perf/budgets.json
E2E_SKIP_BUILD=1 npm run test:e2e      # bez ponownego buildu, gdy .next jest aktualny (kod się nie zmienił)
E2E_KEEP=1 E2E_PORT=4400 npm run test:e2e   # zostawia serwer po testach (stop: scripts/dev/stop.sh 4400)
```
- Wymagania: `service postgresql start` (użytkownik `z`/`z`, albo `PG_ADMIN_URL`), Chromium z `/opt/pw-browsers` albo `CHROME_PATH`. Moduł `playwright` jest w devDependencies; w sesji chmurowej bez `npm ci` działa globalny z `/opt/node22/lib/node_modules/`.
- Każdy test kończy się porażką także przy błędzie konsoli, naruszeniu CSP albo odpowiedzi >= 400 (oczekiwane 4xx: `problems.allow(/401/)` w teście). Zrzuty z nieudanych testów: `zrzuty/e2e/`, w CI artefakt `e2e-zrzuty`.
- Testy idą po kolei na jednej bazie i sprzątają po sobie (Cofnij, odhaczenie, wyłączenie blokady PIN). Nowy scenariusz: `scenario('nazwa', async (page) => {...}, withSession)` w `tests/e2e/zielnik.test.mjs`; stronę otwieraj przez `go(page, '/ścieżka')` (czeka na hydratację Reacta, bez tego klik bywa ignorowany).
- Lighthouse: mediana z 3 przebiegów, `/login` bez sesji, `/` na koncie `ania` z seeda. Mierzy LCP, CLS, TBT (w trybie nawigacji INP nie istnieje, TBT jest jego laboratoryjnym odpowiednikiem), rozmiar JS (przesłane KB) i liczbę żądań. Progi w `tests/perf/budgets.json` = stan z 8.10 plus zapas (LCP x1,4; TBT x1,5 + 100 ms; JS x1,15; CLS +0,05). Stan w dniu ustawienia: `/login` LCP 2,6 s, TBT 95 ms, JS 168 KB; `/` LCP 3,1 s, TBT 130 ms, JS 163 KB, CLS 0.
- Nowe progi po świadomej zmianie: `node scripts/dev/lighthouse.mjs --port <port> --update` wypisuje pomiar i propozycję; przekroczenie bez powodu to regresja do naprawy, nie do podbijania. Poza repo (bez `npm ci`): `LIGHTHOUSE_DIR=<katalog z node_modules z lighthouse@12.8.2 i chrome-launcher>`.
