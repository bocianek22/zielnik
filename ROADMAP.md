# Plan rozwoju

Legenda: **P0** krytyczne przed publicznym startem · **P1** ważne · **P2** wartościowe · **P3** pomysł.
Rozmiar: **S** (godziny) · **M** (dzień lub dwa) · **L** (tydzień i więcej). Zależność: 🌐 domena · ⚖️ prawnik · 💳 firma i płatności · 📧 usługa e-mail.
Bieżąca wersja: **0.15.0** (zamknięta beta, rejestracja z zaproszeniem).

## Kamienie milowe
| Wersja | Cel | Zawartość |
|---|---|---|
| 0.16 | Stabilność i jakość | testy automatyczne, monitoring błędów, poprawki z sekcji 10 |
| 0.17 | Konta i e-mail | 🌐📧 odzyskiwanie hasła, weryfikacja e-mail, sesje |
| 0.18 | Logowanie zewnętrzne | 🌐 Google, Apple |
| 0.19 | Prawo i prywatność | ⚖️ regulamin, polityka, DPIA, zgody |
| 0.20 | Płatności | 💳 Premium: bramka, faktury, zarządzanie subskrypcją |
| **1.0.0** | **Publiczny start** | lista kontrolna z końca dokumentu |
| 1.x | Rozwój | społeczność, B2B, wersja angielska |

## 1. Konta i bezpieczeństwo
- **KON-1 (P0, M, 📧)** Odzyskiwanie hasła e-mailem i weryfikacja adresu.
- **KON-2 (P0, S)** Ochrona unikalności zaproszeń przy błędzie rejestracji (zwrot użycia kodu w transakcji).
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
- **PLA-1 (P0, M)** Testy automatyczne: jednostkowe funkcji SQL widoczności i integracyjne API na osobnej gałęzi bazy Neon.
- **PLA-2 (P0, S)** Monitoring błędów i alerty (np. Sentry) oraz uptime.
- **PLA-3 (P0, S)** Przejście na plan Vercel Pro (użycie komercyjne) i osobna gałąź bazy dla podglądów.
- **PLA-4 (P1, M)** Zdjęcia poza bazą (magazyn obiektów, np. Vercel Blob lub S3) z miniaturami.
- **PLA-5 (P1, M)** Paginacja i pamięć podręczna listy odmian oraz rankingów (dziś ładujemy wszystko naraz).
- **PLA-6 (P1, M)** Migracje bazy jako osobne, wersjonowane pliki (zamiast `ensureDb`).
- **PLA-7 (P1, M)** Kopia zapasowa poza bazą (magazyn zewnętrzny) i automatyczne odtwarzanie.
- **PLA-8 (P2, S)** Nagłówki bezpieczeństwa (CSP, HSTS), audyt zależności.
- **PLA-9 (P2, L)** Przejście na TypeScript.
- **PLA-10 (P2, M)** Prawdziwa aplikacja offline (service worker) i powiadomienia push.

## 8. Interfejs i dostępność
- **UX-1 (P1, M)** Dopracowanie trybu ciemnego na zmiennych CSS (zamiast odwracania kolorów).
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
- **DT-2** Tryb ciemny odwraca kolory całej strony (UX-1).
- **DT-3** Zdjęcia są przechowywane jako base64 w bazie (PLA-4).
- **DT-4** Rankingi i filtry liczą się w przeglądarce ze wszystkich odmian (PLA-5).
- **DT-5** Strefa czasowa `Europe/Warsaw` jest wpisana na stałe.
- **DT-6** Import CSV ogranicza do 200 wierszy i nie ma podglądu błędów przed zapisem.
- **DT-7** Wspólny katalog odmian może edytować każdy zalogowany (KAT-1).
- **DT-8** Limit prób logowania opiera się o adres z `x-forwarded-for`.
- **DT-9** Regulamin, polityka prywatności i treści Wiedzy są projektem roboczym (PRA-1, KAT-4).
- **DT-10** Zamknięcie zaproszenia przy nieudanej rejestracji nie jest cofane (KON-2).

## Lista kontrolna publicznego startu (1.0.0)
- [ ] KON-1, KON-3 (przynajmniej Google), PRA-1, PRA-2, PRA-3
- [ ] PLA-1, PLA-2, PLA-3, PLA-7
- [ ] KAT-1, KAT-4
- [ ] MON-1 lub świadoma decyzja o starcie bez płatności
- [ ] Przegląd bezpieczeństwa (PLA-8) i dostępności (UX-2)
- [ ] Otwarcie rejestracji lub utrzymanie zaproszeń
