# Przygotowanie do bety (od 8.10)

Decyzje właściciela (8.10):
- **Faza 1, zamknięta beta:** 5-20 znajomych pacjentów z zaproszeniem, start ok. 15-17.10.
- **Faza 2, otwarta beta:** później. Wszystko przygotowujemy tak, żeby przejście nie wymagało przeróbek.
- **Platformy:** Android (APK), przeglądarka i PWA na Androidzie, iPhone (Safari i PWA), komputer.
- **Zgłoszenia:** formularz w aplikacji oraz grupa testerów (link w aplikacji).

Legenda: **[C]** robi Claude lub agenci, **[W]** robi właściciel, **[P]** wymaga prawnika.

## Faza 1: zamknięta beta (do 15.10)

### A. Zgłaszanie uwag i komunikacja z testerami [C]
- [ ] **Przycisk „Zgłoś uwagę”** w menu „Więcej” i na stronie błędu:
  - kategoria (błąd, pomysł, inne), opis;
  - automatycznie: wersja, ekran (ścieżka bez identyfikatorów), platforma (APK/PWA/przeglądarka), motyw, tryb dyskretny;
  - bez danych zdrowotnych i bez zrzutów ekranu;
  - tabela `beta_feedback`, lista w panelu admina (status: nowe, w toku, zrobione), powiadomienie na `ALERT_WEBHOOK_URL`.
- [ ] **Link do grupy testerów** (`BETA_GROUP_URL`) w „Zgłoś uwagę” i w „Pomocy”; bez zmiennej link jest ukryty.
- [ ] **„Co nowego”:** krótka lista zmian z ostatnich wersji (z `CHANGELOG.md`, prostym językiem), raz po aktualizacji.
- [ ] **Oznaczenie „Beta”** i numer wersji w profilu.
- [ ] **Strona „Pomoc”:**
  - jak zacząć;
  - instalacja: APK, PWA na Androidzie, iPhone „Dodaj do ekranu początkowego”;
  - jak zgłaszać błędy, znane ograniczenia, FAQ (tryb dyskretny, prywatność danych, eksport i usunięcie konta).

### B. Prawo i prywatność (wersje robocze do przeglądu przez prawnika) [C], [P] przed fazą 2
- [ ] **Regulamin bety:**
  - wersja testowa, bez gwarancji ciągłości;
  - nie jest wyrobem medycznym i nie zastępuje lekarza;
  - zasady katalogu i propozycji.
- [ ] **Polityka prywatności, aktualizacja:**
  - lista podmiotów przetwarzających (Vercel, Neon, Anthropic dla podpowiedzi i odczytu zdjęć, Resend dla e-maili, Google FCM dla powiadomień), gdzie dane są przechowywane;
  - dane szczególnej kategorii (art. 9 RODO) i wyraźna zgoda;
  - okresy przechowywania (kopie, dziennik błędów, zgłoszenia), prawa użytkownika, kontakt.
- [ ] **Zgoda przy rejestracji z wersją dokumentów** (`consent_version`). Po zmianie dokumentów prośba o ponowną akceptację.
- [ ] **Sprawdzenie, co wysyłamy do podmiotów zewnętrznych:**
  - podpowiedzi: tylko nazwa odmiany i producent;
  - alerty: bez treści błędów;
  - e-maile: neutralne;
  - opis wyniku w polityce.

### C. Jakość na wszystkich platformach [C], ręcznie [W]
- [ ] Scalenie 0.48.0 i widżetu Androida (POM-13), nowe APK 0.4.0 do pobrania w aplikacji (sprawdzenie wersji).
- [ ] E2E także na szerokości komputera (1280 px): raport dla lekarza, eksport, tabele.
- [ ] **Safari i iPhone:** w kontenerze nie ma silnika WebKit, więc E2E nie da się tu uruchomić. Zamiast tego:
  - przegląd kodu pod znane różnice (`IndexedDB` w trybie prywatnym, `position: fixed` z klawiaturą, `input type=date`, PWA bez powiadomień przed iOS 16.4);
  - ręczna lista kontrolna dla właściciela.
- [ ] **Ręczny test właściciela [W]** na Androidzie (APK i Chrome), iPhonie i komputerze według listy w `docs/HANDOFF.md` (sekcja 6), przed wysłaniem zaproszeń.
- [ ] **Lighthouse i axe** na nowych ekranach (kreator, pomoc, zgłoszenia).

### D. Bezpieczeństwo, dane i działanie w produkcji [C]
- [ ] **Panel admina „Gotowość”:** które funkcje są skonfigurowane (zmienne obecne, ale nigdy ich wartości), m.in.:
  - siła `AUTH_SECRET`, klucz kopii, e-mail, push, alerty, `APP_URL`;
  - wersja PostgreSQL, ostatnia udana kopia, ostatni cron.
- [ ] **Próba odtworzenia kopii:** skrypt odtwarza kopię do lokalnej bazy i porównuje liczby wierszy; instrukcja w `docs/ARCHITEKTURA.md`.
- [ ] **`/api/health`:** baza i schemat, bez danych; pod zewnętrzny monitoring dostępności (np. darmowy UptimeRobot).
- [ ] **Przegląd bezpieczeństwa przed betą (PLA-8, skrót):**
  - zależności (`npm audit`);
  - limity prób na nowych trasach;
  - nagłówki;
  - uprawnienia admina;
  - testy usunięcia konta i eksportu end-to-end.
- [ ] **Ochrona konta admina:** drugi składnik (TOTP) albo co najmniej długie hasło i powiadomienie o każdym logowaniu admina.
- [ ] **Zbiorcze wskaźniki bety** w panelu admina, bez danych pojedynczych osób:
  - aktywne konta w 7 dniach;
  - odsetek kont z odmianą, receptą i zużyciem;
  - liczba zgłoszeń.

### E. Konfiguracja i organizacja [W]
- [ ] **Vercel, zmienne środowiskowe:**
  - `AUTH_SECRET` co najmniej 32 znaki, `BACKUP_ENCRYPTION_KEY`, `APP_URL`;
  - `ALERT_WEBHOOK_URL` (Discord lub Slack);
  - `BETA_GROUP_URL`;
  - e-mail: `RESEND_API_KEY` i `MAIL_FROM` z domeną zweryfikowaną w Resend;
  - push: `VAPID_*` i `CRON_SECRET`;
  - `SUGGEST_DOMAINS` usunąć.
- [ ] **Grupa testerów** (Messenger, Discord albo WhatsApp) i krótka wiadomość powitalna. Szkic przygotuje Claude.
- [ ] **Lista 5-20 osób**, zaproszenia z panelu admina (limit użyć, ważność).
- [ ] **Własny test na telefonie** przed wysłaniem zaproszeń.

## Faza 2: otwarta beta (po fazie 1)
- [ ] **[P]** Prawnik: regulamin, polityka prywatności, DPIA (PRA-1/2/3), ocena reklamy produktów leczniczych (KAT-4, POM-29/30/31/39).
- [ ] **[W]** Domena i adres e-mail na domenie, Vercel Pro (cron co godzinę, dłuższe logi), plan Neon z kopiami w czasie (PITR).
- [ ] **[C]** Otwarta rejestracja za flagą:
  - limity rejestracji na IP;
  - ochrona przed botami (np. Turnstile);
  - potwierdzenie e-maila wymagane, gdy działa wysyłka.
- [ ] **[C]** Moderacja: zgłoszenia treści (`ReportButton`), propozycje katalogu (KAT-1), blokady.
- [ ] **[C]** Wydajność przy większej liczbie kont: indeksy, pula połączeń, budżety Lighthouse, test obciążenia na kopii bazy.
- [ ] **[C]** Strona stanu i komunikaty o przerwach.
- [ ] **[W]** Decyzja o płatnościach (MON-1) albo świadomy start bez nich.

## Stan
- 8.10: plan zapisany; start prac A i D (agenci), B i C w kolejnej turze.
- 8.10: sekcje A, B, D oraz widżet gotowe jako 0.49.0 (przegląd Opus, poprawki). TOTP admina odłożone (ryzyko zablokowania jedynego admina), zamiast niego powiadomienie o logowaniu. Do zrobienia: sekcja C (E2E 1280 px, przegląd pod Safari, lista ręczna, wiadomość powitalna dla grupy) i zadania właściciela (sekcja E).
