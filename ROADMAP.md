# Plan rozwoju

Legenda: **P0** krytyczne przed publicznym startem · **P1** ważne · **P2** wartościowe · **P3** pomysł.
Rozmiar: **S** (godziny) · **M** (dzień lub dwa) · **L** (tydzień i więcej). Zależność: 🌐 domena · ⚖️ prawnik · 💳 firma i płatności · 📧 usługa e-mail.
Bieżąca wersja: **0.22.1** (zamknięta beta, rejestracja z zaproszeniem).

## Kamienie milowe
| Wersja | Cel | Zawartość |
|---|---|---|
| 0.16 ✅ | Stabilność i jakość (część 1) | testy funkcji czystych, dziennik błędów, KON-2 |
| 0.16.x | Stabilność i jakość (część 2) | testy SQL i API (Neon), alerty i uptime, poprawki z sekcji 10 |
| 0.17 ✅ | Mobile, część 1 | dolna nawigacja, cele dotykowe (MOB-1, MOB-2) |
| 0.18 | Mobile, część 2 | MOB-3 do MOB-11: karta mobilna, lista, PWA, wydajność |
| 0.19 | Konta i e-mail | 🌐📧 odzyskiwanie hasła, weryfikacja e-mail, sesje |
| 0.20 | Logowanie zewnętrzne | 🌐 Google, Apple |
| 0.21 | Prawo i prywatność | ⚖️ regulamin, polityka, DPIA, zgody |
| 0.22 | Płatności | 💳 Premium: bramka, faktury, zarządzanie subskrypcją |
| **1.0.0** | **Publiczny start** | lista kontrolna z końca dokumentu |
| 1.x | Rozwój | społeczność, B2B, wersja angielska |

## 1. Konta i bezpieczeństwo
- **KON-1 (P0, M, 📧)** Odzyskiwanie hasła e-mailem i weryfikacja adresu.
- ~~**KON-2 (P0, S)** Zwrot użycia kodu zaproszenia przy nieudanej rejestracji~~ ✅ 0.16.0
- **KON-3 (P1, M, 🌐)** Logowanie przez Google, potem Apple.
- **KON-4 (P1, M)** Lista aktywnych sesji i wylogowanie z innych urządzeń.
- **KON-5 (P1, M)** Uwierzytelnianie dwuskładnikowe (TOTP).
- **KON-6 (P2, S)** Sprawdzanie haseł na listach wycieków; wymóg złożoności.
- **KON-7 (P2, M, 🌐)** Adresy profili `nick.domena.pl`.
- **KON-8 (P2, S)** Ochrona ostatniego admina (nie można go usunąć ani zdegradować).

## 2. Prywatność, prawo i zgodność
- **PRA-1 (P0, ⚖️)** Przegląd regulaminu i polityki prywatności; rejestr czynności przetwarzania.
- **PRA-2 (P0, ⚖️, M)** Ocena skutków dla ochrony danych (DPIA) dla danych zdrowotnych.
- **PRA-3 (P0, ⚖️)** Analiza zakazów reklamy (produkty lecznicze, apteki) dla katalogu i cen.
- **PRA-4 (P1, M)** Historia akceptacji regulaminu (wersje, daty) i ponowna zgoda po zmianie.
- **PRA-5 (P1, M)** Okres przechowywania danych i automatyczne czyszczenie nieaktywnych kont.
- **PRA-6 (P2, S)** Ustawienia widoczności domyślnej użytkownika.

## 3. Dane pacjenta
- **PAC-1 (P1, M)** Wersje partii: ta sama odmiana z różnymi seriami i stężeniami, osobne oceny.
- **PAC-2 (P1, M)** Certyfikat badań (COA) jako załącznik partii i ostrzeżenie o różnicach stężeń.
- **PAC-3 (P1, M)** Przypomnienia o wykupie recepty, terminie ważności i końcu zapasu (e-mail lub push).
- **PAC-4 (P2, M)** Powiązanie zakupów z receptą (zamiast szacunku po datach).
- **PAC-5 (P2, M)** Wiele zdjęć odmiany i galeria testów.
- **PAC-6 (P2, M)** Własne pola i etykiety użytkownika.
- **PAC-7 (P2, L)** Analiza zależności: odmiany, dawki i objawy (wykresy korelacji, bez wniosków medycznych).
- **PAC-8 (P3, M)** Dokumenty i zdjęcia recept (zawsze prywatne, szyfrowane).

## 4. Społeczność
- **SPO-1 (P1, M)** Komentarze pod opiniami i testami.
- **SPO-2 (P1, M)** Czat grupowy w grupach (bez czatów prywatnych 1 na 1).
- **SPO-3 (P2, S)** Role w grupie (moderator, gość) i poziom widoczności „grupa”.
- **SPO-4 (P2, S)** Reakcje „przydatne” (bez publicznych rankingów użytkowników).
- **SPO-5 (P2, M)** Obserwowanie profili za zgodą.
- **SPO-6 (P3, M)** Zestawienia i listy odmian tworzone przez użytkowników.

## 5. Katalog i treści
- **KAT-1 (P1, M)** Model własności katalogu odmian: propozycje zmian i zatwierdzanie zamiast wspólnej edycji.
- **KAT-2 (P1, S)** Podpowiadanie nazw z katalogu przy dodawaniu odmiany.
- ~~**KAT-11** Karta charakterystyki, podpowiedź opisu z internetu, szczegóły w katalogu~~ ✅ 0.18.0
- **KAT-12 (P1, M)** Weryfikacja i ocena jakości podpowiedzi AI (oznaczanie błędów przez użytkowników, ręczna korekta, historia zmian opisu).
- **KAT-13 (P2, M)** Średnie ceny w czasie (wykres) i porównanie z ceną katalogową; wykrywanie odstających zgłoszeń.
- **KAT-14 (P2, S)** Polskie źródła w podpowiedziach (po ustaleniu wiarygodnych serwisów) i tłumaczenie treści.
- **KAT-3 (P1, M)** Źródło danych katalogu: uzgodnione, legalne, z monitorowaniem jakości.
- **KAT-4 (P1, L, ⚖️)** Przegląd merytoryczny działu Wiedza (źródła, aktualizacja, wersje).
- **KAT-5 (P2, M)** Historia cen i dostępności odmian.
- **KAT-6 (P2, L)** Oleje i peny: pełne dane (stężenia, objętości, wkłady).

## 6. Monetyzacja
- **MON-1 (P1, L, 💳)** Bramka płatności (Stripe, Przelewy24 lub Tpay), webhooki, zarządzanie subskrypcją, faktury.
- **MON-2 (P1, S)** Włączenie `PREMIUM_ENFORCED` i komunikaty przy funkcjach płatnych.
- **MON-3 (P2, S)** Strona wsparcia i przejrzyste cele finansowe projektu.
- **MON-4 (P3, L, ⚖️)** Panel dla lekarzy i klinik (za zgodą pacjenta): udostępnianie raportów, konta zawodowe.

## 7. Platforma i infrastruktura
- **PLA-1 (P0, M)** Testy automatyczne. ✅ 0.16.0: funkcje czyste (`npm test`, CI). Do zrobienia: testy funkcji SQL widoczności (`can_see`) i integracyjne API na osobnej gałęzi bazy Neon.
- **PLA-2 (P0, S)** Monitoring błędów. ✅ 0.16.0: własny dziennik błędów w panelu admina. Do zrobienia: alerty (e-mail lub komunikator) i uptime.
- **PLA-3 (P0, S)** Przejście na plan Vercel Pro (użycie komercyjne) i osobna gałąź bazy dla podglądów.
- **PLA-4 (P1, M)** Zdjęcia poza bazą (magazyn obiektów, np. Vercel Blob lub S3) z miniaturami.
- **PLA-5 (P1, M)** Paginacja i pamięć podręczna listy odmian oraz rankingów (dziś ładujemy wszystko naraz).
- **PLA-6 (P1, M)** Migracje bazy jako osobne, wersjonowane pliki (zamiast `ensureDb`).
- **PLA-7 (P1, M)** Kopia zapasowa poza bazą (magazyn zewnętrzny) i automatyczne odtwarzanie.
- **PLA-8 (P2, S)** Nagłówki bezpieczeństwa (CSP, HSTS), audyt zależności.
- **PLA-9 (P2, L)** Przejście na TypeScript.
- **PLA-10 (P2, M)** Prawdziwa aplikacja offline (service worker) i powiadomienia push.

## 8. Interfejs i dostępność
- **UX-1 (P1, M)** Dopracowanie trybu ciemnego. ✅ częściowo 0.21.0 (fundament na zmiennych). Zostaje: kontrast plakietek/chipów ze stałymi kolorami, ikony, wykresy SVG na canvasie koła fortuny.
- **UX-2 (P1, M)** Audyt dostępności (WCAG 2.2 AA): kontrasty, czytniki ekranu, klawiatura.
- **UX-3 (P1, S)** Szybkie akcje z listy („zużyłem”, „wykupiłem” bez wchodzenia w kartę).
- **UX-4 (P2, L)** Wersja angielska (i18n).
- **UX-5 (P2, S)** Puste stany, komunikaty i ładowanie w całej aplikacji.
- **UX-6 (P3, M)** Kreator pierwszego uruchomienia dla nowych użytkowników.

## 9. Administracja i moderacja
- **ADM-1 (P1, M)** Dziennik zdarzeń (audit log): kto, co i kiedy zmienił.
- **ADM-2 (P1, M)** Rozbudowana moderacja: zawieszanie kont, historia zgłoszeń, powiadomienia dla moderatorów.
- **ADM-3 (P2, M)** Role: moderator i redaktor treści (bez pełnego admina).
- **ADM-4 (P2, S)** Rozszerzone statystyki i eksport (bez danych zdrowotnych).

## 10. Poprawki i dług techniczny (znane ograniczenia)
- **DT-1** Zapytania SQL o widoczność i pule powstały bez zautomatyzowanych testów (patrz PLA-1).
- ~~**DT-2** Tryb ciemny odwracał kolory całej strony~~ ✅ 0.21.0 (przepisany na zmienne CSS).
- **DT-3** Zdjęcia są przechowywane jako base64 w bazie (PLA-4).
- **DT-4** Rankingi i filtry liczą się w przeglądarce ze wszystkich odmian (PLA-5).
- **DT-5** Strefa czasowa `Europe/Warsaw` jest wpisana na stałe.
- **DT-6** Import CSV ogranicza do 200 wierszy i nie ma podglądu błędów przed zapisem.
- **DT-7** Wspólny katalog odmian może edytować każdy zalogowany (KAT-1).
- **DT-8** Limit prób logowania opiera się o adres z `x-forwarded-for`.
- **DT-9** Regulamin, polityka prywatności i treści Wiedzy są projektem roboczym (PRA-1, KAT-4).
- ~~**DT-10** Zamknięcie zaproszenia przy nieudanej rejestracji nie było cofane~~ ✅ 0.16.0

## 11. Wersja mobilna (MOB): priorytet, bo to ok. 90% użyć
Cele wydajności: LCP < 2,5 s, INP < 200 ms, CLS < 0,1 na średnim telefonie i sieci 4G.
- ~~**MOB-1 (P0, M)** Dolny pasek nawigacji i arkusz „Więcej”~~ ✅ 0.17.0 (do ujednolicenia z górnym menu, patrz MOB-17)
- ~~**MOB-2 (P0, S)** Cele dotykowe ≥ 44 px, pola ≥ 16 px~~ ✅ 0.17.0
- ~~**MOB-3 (P0, M)** Karta odmiany~~ ✅ 0.19.0 (zwijane szczegóły; dalej: szybkie akcje na wierzchu). Pierwotnie: karta odmiany „mobile-first”: na wierzchu nazwa, ocena, stan i szybkie akcje (zużyłem, wykupiłem), reszta w rozwijanych sekcjach.
- ~~**MOB-4 (P0, M)** Lista odmian~~ ✅ 0.19.0 (panel filtrów, paginacja; dalej: szkielety ładowania, wirtualizacja). Pierwotnie: lista odmian: paginacja lub wirtualizacja, szkielety ładowania, filtry i sortowanie w arkuszu „Filtry” zamiast rzędu kontrolek.
- ~~**MOB-5 (P0, S)** Pływający przycisk~~ ✅ 0.19.0. Pierwotnie: pływający przycisk „+” (nowa odmiana, szybki wpis zużycia lub objawów).
- **MOB-6 (P1, M)** Formularze w pełnoekranowych arkuszach. ✅ częściowo 0.22.0 (formularz odmiany). ✅ 0.22.1: `inputMode` uzupełniony na wszystkich polach liczbowych w aplikacji. Zostaje: formularze testów, dodawanie krok po kroku.
- **MOB-7 (P1, M)** Gesty: przeciągnięcie do odświeżenia, przesunięcie karty do szybkiego zużycia.
- **MOB-8 (P1, L)** PWA. ✅ częściowo 0.20.0 (service worker, cache powłoki, strona offline). Zostaje: pełny odczyt danych offline, kolejka zapisów offline, monit instalacji, ekran startowy.
- **MOB-9 (P1, M)** Wydajność front-endu. ✅ częściowo 0.19.0 (czcionka) i 0.20.0 (leniwe ładowanie koła/wykresów, szkielety). Zostaje: `next/image` z miniaturami, analiza rozmiaru paczek.
- **MOB-10 (P1, M, ryzykowne — zmiana zapytania SQL `listStrains`)** Lżejsze dane: lista odmian bez pełnych wpisów innych osób (doczytywanie na podstronie), nagłówki cache, SWR. Wymaga testu na koncie z wieloma znajomymi przed wdrożeniem.
- ~~**MOB-11 (P1, M)** Tryb ciemny na zmiennych CSS~~ ✅ 0.21.0. Zostaje dopracowanie kontrastu drugorzędnych plakietek/chipów (UX-1, UX-2).
- **MOB-12 (P2, M)** Wykresy dotykowe (podpowiedź po dotknięciu, większe obszary).
- **MOB-13 (P2, S)** Wibracja przy zapisie, szanowanie `prefers-reduced-motion`.
- **MOB-14 (P2, M)** Web Share (profil, zaproszenie) i skróty aplikacji w manifeście („Zużyłem”, „Dziennik”).
- **MOB-15 (P2, S)** Testy na urządzeniach (iOS Safari, Android Chrome; szerokości 320, 360, 390, 430) i Lighthouse w CI.
- **MOB-16 (P3, L)** Aplikacja natywna (Capacitor lub Expo), jeśli PWA okaże się za słabe (powiadomienia push na iOS).
- **MOB-17 (P1, S)** Jedna lista pozycji menu dla górnego i dolnego paska (dziś zduplikowana w `Header.js` i `BottomNav.js`).

## 12. Backlog pomysłów (do rozpisania i przypisania do wersji)
**Konta i prywatność:** KON-9 klucze dostępu (passkeys) · KON-10 logowanie linkiem e-mail · KON-11 blokada aplikacji PIN lub biometrią · PRA-7 „tryb dyskretny” (neutralna nazwa i ikona, ukrywanie nazw odmian) · PRA-8 szyfrowanie pól wrażliwych (recepty, objawy) · PLA-11 region UE dla bazy i funkcji (RODO).
**Pacjent:** PAC-9 harmonogram i przypomnienia dawek · PAC-10 podsumowanie miesiąca („Twój miesiąc”) · PAC-11 skanowanie kodu z opakowania (dane partii) · PAC-12 rozpoznawanie cennika lub recepty ze zdjęcia i zamiana na CSV · PAC-13 lista życzeń „chcę spróbować” · PAC-14 standardowe skale objawów (np. VAS bólu) · PAC-15 tryb opiekuna (dostęp za zgodą dla bliskiej osoby) · PAC-16 przypomnienie o wizycie i kończącej się recepcie.
**Społeczność:** SPO-7 poradniki od użytkowników (moderowane) · SPO-8 tematyczne wątki w grupach · SPO-9 zgłaszanie błędnych danych w katalogu · SPO-10 tłumaczenia treści przez społeczność.
**Katalog i treści:** KAT-7 alerty o nowych odmianach i powrocie do dostępności · KAT-8 alerty o wycofaniu partii · KAT-9 słownik pojęć i quizy edukacyjne · KAT-10 źródła naukowe z linkami przy artykułach.
**Monetyzacja:** MON-5 plany roczne i kody promocyjne · MON-6 plan rodzinny lub opiekuna · MON-7 opcjonalne, zanonimizowane dane do badań (za zgodą, po analizie prawnej).
**Platforma:** PLA-12 flagi funkcji per użytkownik · PLA-13 webhooki i integracje (np. kalendarz) · PLA-14 środowisko stagingowe z osobną bazą · PLA-15 automatyczne kopie poza infrastrukturą aplikacji · PLA-16 Lighthouse i budżety wydajności w CI.

## Lista kontrolna publicznego startu (1.0.0)
- [ ] KON-1, KON-3 (przynajmniej Google), PRA-1, PRA-2, PRA-3
- [ ] PLA-1, PLA-2, PLA-3, PLA-7
- [ ] KAT-1, KAT-4
- [ ] MON-1 lub świadoma decyzja o starcie bez płatności
- [ ] Przegląd bezpieczeństwa (PLA-8) i dostępności (UX-2)
- [ ] Otwarcie rejestracji lub utrzymanie zaproszeń
