# Historia zmian

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersjonowanie zgodne z [SemVer](https://semver.org/lang/pl/) (`MAJOR.MINOR.PATCH`).
Do wersji 1.0.0 (publiczny start) każda nowa funkcja podnosi `MINOR`, a poprawka błędu `PATCH`.

Wersje 0.1.0 do 0.14.0 zostały odtworzone z historii prac (wgrywanych paczkami przez GitHub). Nie mają znaczników `git`.
Pierwsze wydanie ze znacznikiem to **v0.15.0**. Kolejne wydania tworzy workflow „Wydanie” (patrz `CONTRIBUTING.md`).

## [Unreleased]

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

[Unreleased]: https://github.com/bocianek22/zielnik/compare/v0.18.0...HEAD
[0.18.0]: https://github.com/bocianek22/zielnik/compare/v0.17.1...v0.18.0
[0.17.1]: https://github.com/bocianek22/zielnik/compare/v0.17.0...v0.17.1
[0.17.0]: https://github.com/bocianek22/zielnik/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/bocianek22/zielnik/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/bocianek22/zielnik/releases/tag/v0.15.0
