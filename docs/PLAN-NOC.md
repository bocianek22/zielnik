# Plan nocny (koordynator) - do 11:00 UTC (13:00 czasu właściciela)

Właściciel śpi. Działam sam: planuję, zlecam agentom, scalam, testuję. Nie scalam do main bez zgody (chyba że właściciel odpisze, że mogę).
Gałąź: claude/project-review-planning-rcakq1. Na koniec: jeden PR z opisem i zrzutami przed/po.

## Kolejka
1. [w toku] Design lead (Opus): audyt zrzutów, docs/DESIGN.md, tokeny, nawigacja, lista odmian, karta, szczegóły, profil, logowanie.
2. [w toku] Natywne dopracowanie (Sonnet): haptyka, pull-to-refresh, przejścia, splash/ikona, offline, klawiatura, wersja.
3. Po (1): rozdzielić pozostałe ekrany wg listy z docs/DESIGN.md na 3-4 agentów Sonnet (rozłączne pliki): katalog+rankingi+koło; historia+dziennik+recepty+raport; znajomi+grupy+profil publiczny+wiedza+premium; admin.
4. Reviewer (Opus) całości UI + natywnej; poprawki.
5. Wersja 0.31.0: CHANGELOG, HANDOFF, ROADMAP; PR; CI (w tym APK).
6. Jeśli czas zostanie: wysyłka FCM po stronie serwera (bez kluczy - kod + testy z mockiem), PLA-5 paginacja UI, KAT-1 krok 2.

## Zasady
- Po każdym scaleniu: check, test, build, test:db (service postgresql start; baza zielnik_test).
- Konflikty w globals.css: zachowaj obie strony, potem uporządkuj.
- Limit API: przy wznowieniu sprawdź agentów (worktree w .claude/worktrees), zacommituj WIP, wznów przez SendMessage albo nowego agenta od WIP.

## Limity i trwałość (uzupełnienie 02:00 UTC)
- Okna limitu odnawiają się o :20 co 6 h (01:20, 07:20, 13:20 UTC). Do 07:20 najwyżej 2 agentów (Opus tylko design lead, reszta Sonnet). Fan-out ekranów, reviewer i PR w oknie od 07:20.
- Każde wznowienie zaczyna się od `service postgresql start`. Gotowe wyniki agentów scalać i pushować od razu.
- Kolejność scalania: najpierw natywne (dotyka StrainsBoard, profil, globals.css, grupy, znajomi, recepty), potem design lead robi merge gałęzi przed dalszymi zmianami tych plików.
- Przed scaleniem redesignu koordynator SAM ogląda 4-6 par zrzutów przed/po (lista, karta, profil, logowanie, tryb ciemny, tryb dyskretny) i sprawdza .dn, brand-alt, html.native-app. Reviewer dostaje te same trzy kontrole.
- Rano: PR otwarty, NIE scalony (brak zgody właściciela). W podsumowaniu wysłać pary zrzutów (SendUserFile) i link do przebiegu APK.

## Stan 02:35 UTC
- Scalone i wypchnięte: natywne dopracowanie (59cf4b2), redesign 1 - system projektowy, nawigacja, lista, karta, szczegóły, profil, logowanie (39887a1). Zrzuty przed/po: scratchpad/design/{before,after}.
- W toku (Sonnet): paczka H (formularze + poprawki karty: „+” zasłania „Edytuj”, przecinki w podpowiedziach i szybkich wartościach, przerwa pod „Twoje pola”), paczki C+D (historia, raport, dziennik, recepty, tokeny --chart-*).
- Po 07:20 UTC: paczki A (katalog, szukaj), B (rankingi, koło), E (społeczność), F (wiedza, premium, prywatność), G (admin), I (systemowe, porównanie); potem reviewer (Opus) z kontrolą trybu ciemnego, dyskretnego i native-app; wersja 0.31.0, PR.
- 03:05 UTC: scalone C+D (bd886fe) i H (formularze, karta, odstęp pod „+”). W toku A+B. Uwagi dla reviewera: karta na 320 px - etykiety Ocena/Mam teraz/Do wykupienia łamią się na 3 linie (rozważyć 2 kolumny <360 px), „Cena u mnie (zł/g), tworzy średnią cen” ucięta; ciemny pasek nad arkuszem formularza (safe-area). Skrypty start.sh z pkill zabijają serwery innych agentów - usuwać pkill.
