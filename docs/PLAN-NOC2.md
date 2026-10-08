# Plan nocny 2 (koordynator), noc 4/5 października 2026

Właściciel śpi i pozwolił pracować do wyczerpania limitu oraz wznawiać automatycznie. Zasady: `docs/AGENCI.md` (najwyżej 2 agentów, Sonnet do implementacji, Opus tylko do przeglądu przed wydaniem), `CLAUDE.md`. Koordynator scala PR sam po zielonym CI i sprawdza produkcję (Vercel: stan READY, błędy runtime, nagłówek CSP).

## Kolejka (w tej kolejności)
1. [zrobione] Wspólne narzędzia `scripts/dev/` (Sonnet).
2. [zrobione, scalone PR #9] Wydanie 0.37.0 (2 agentów Sonnet, rozłączne pliki):
   - POM-03 pora i sposób przyjęcia przy „Zużyłem” (opcjonalne pola, g/ml, offline, raport i obserwacje mogą je pokazać opisowo).
   - POM-11 eksport CSV dziennika (objawy + zużycie + zakupy, jednostki, czas polski) + POM-20 puste stany prowadzące do pierwszego wpisu.
   - Przegląd całości (reviewer Opus) przed PR; poprawki blokujących.
3. [zrobione, PR #10] Wydanie 0.38.0:
   - POM-25 blokada PIN/biometrią także w PWA (WebAuthn lub PIN lokalny) i automatyczne wylogowanie po bezczynności (opcja).
   - POM-27 lista sesji i urządzeń z wylogowaniem pojedynczej sesji (decyzja z `docs/BEZPIECZENSTWO.md`).
4. [zrobione, PR #11] Wydanie 0.39.0: POM-07 własne objawy i skale; POM-23 wydajność ekranu głównego.
5. [zrobione] Agent `innowacje`: odświeżenie `docs/POMYSLY.md` (statusy, nowe pomysły po 0.36-0.38).

## Wznowienia
Okna limitu odnawiały się co ok. 5 h (ostatnio 22:50 UTC). Zaplanowane wznowienia sesji: 04:20 i 09:40 UTC. Przy wznowieniu: `service postgresql start`, sprawdzić `.claude/worktrees` (WIP zacommitować, agenta wznowić przez SendMessage), dalej według kolejki.

## Stan
- 0.36.0 scalone (PR #8), APK z przebiegu „Aplikacja Android” #11.
- 0.37.0 scalone (PR #9) 4.10 09:42 UTC, produkcja READY, bez błędów runtime, CSP z nonce. POM-25 scalone do gałęzi (5e1163b). Agenci 0.38.0 zatrzymani limitem w nocy (bez zmian), wznowieni 09:45 UTC.
- 0.38.0 scalone (PR #10) 10:16 UTC: POM-25 + POM-27 + poprawki z przeglądu. Start 0.39.0: POM-07 (backend-db) i POM-23 (frontend-mobile).
- 0.39.0: POM-07 + POM-23 + innowacje (POMYSLY.md) scalone, przegląd i poprawki 6.10 (agenci Sonnet: limit tygodniowy do 7.10 01:00 UTC, poprawki robione przez koordynatora).
- 0.39.0 scalone (PR #11) 6.10 00:21 UTC.
- 0.40.0 scalone (PR #12) 6.10 00:29 UTC: POM-33, POM-34 (koordynator sam).
- 0.41.0 scalone (PR #13) 6.10 00:48 UTC: POM-38 (koordynator sam, przegląd Opus).
- 0.42.0 scalone (PR #14) 6.10 00:57 UTC: POM-37 (koordynator sam).
- 0.43.0 scalone (PR #15) 6.10 01:09 UTC: POM-36 (koordynator sam).
- 0.44.0 scalone (PR #16) 6.10 01:14 UTC: POM-18 część (koordynator sam). Dalej: przerwa do odnowienia agentów (7.10 01:00 UTC) albo POM-35/POM-24 z agentem.
