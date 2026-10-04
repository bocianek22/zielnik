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
