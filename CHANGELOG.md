# Historia zmian

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersjonowanie zgodne z [SemVer](https://semver.org/lang/pl/) (`MAJOR.MINOR.PATCH`).
Do wersji 1.0.0 (publiczny start) każda nowa funkcja podnosi `MINOR`, a poprawka błędu `PATCH`.

Wersje 0.1.0 do 0.14.0 zostały odtworzone z historii prac (wgrywanych paczkami przez GitHub). Nie mają znaczników `git`.
Pierwsze wydanie ze znacznikiem to **v0.15.0**. Kolejne wydania tworzy workflow „Wydanie” (patrz `CONTRIBUTING.md`).

## [Unreleased]

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

[Unreleased]: https://github.com/bocianek22/zielnik/compare/v0.15.0...HEAD
[0.15.0]: https://github.com/bocianek22/zielnik/releases/tag/v0.15.0
