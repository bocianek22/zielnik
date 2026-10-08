# POM-28: szyfrowanie notatek w bazie (projekt, 8.10)

## Decyzja: szyfrowanie po stronie serwera, AES-256-GCM, klucz w env
- **Chroni przed:**
  - zrzutem bazy Neon i podglądem w konsoli;
  - wyciekiem `DATABASE_URL` bez env Vercel;
  - kopiami w `backups.data`;
  - kopią w Blob, którą ktoś odszyfrował samym `BACKUP_ENCRYPTION_KEY`.
- **Nie chroni przed:** przejętym env lub funkcją Vercel, adminem aplikacji, przejętym kontem, metadanymi (daty, liczby i skale zostają jawne).
- **E2E (szyfrowanie na urządzeniu) odłożone po 1.0, bo:**
  - utrata hasła oznaczałaby utratę danych i przekreślała reset hasła mailem;
  - notatki są widoczne dla znajomych przez `can_see`;
  - raport, eksport i przypomnienia działają na serwerze;
  - przy wielu urządzeniach i w APK trzeba by synchronizować klucz.

## Zakres
- **Szyfrowane kolumny:** `symptom_log.note`, `user_strain.notes`, `prescriptions.note`, `strain_tests.note`, `doctor_notes.text`.
- **Poza zakresem:**
  - `symptom_custom.name` (unikalny indeks);
  - `beta_feedback.body` i `reports.note` (czyta je admin);
  - `users.bio` (profil publiczny).

## Format
- Szyfrogram: `zenc1:<kid>:<base64(iv12 ‖ tag16 ‖ ct)>`. Pusty tekst zostaje `''`, więc warunki `note <> ''` działają bez zmian.
- Klucze: `DATA_ENCRYPTION_KEY="k2:<b64-32B>,k1:<b64-32B>"`. Pierwszy szyfruje, pozostałe tylko odszyfrowują (rotacja). Klucz jest osobny od `BACKUP_ENCRYPTION_KEY`.
- AAD: `zielnik|<tabela>.<kolumna>|<zakres>`, gdzie zakres to konto i niezmienny klucz wiersza: `symptom_log` `user_id|day`, `user_strain` `user_id|strain_id`, `prescriptions` `user_id|id`, `strain_tests` samo `id` (`user_id` może przejść w SET NULL). Szyfrogramu nie da się więc przenieść do innego wiersza, także tego samego konta.
- **Jawny tekst z prefiksem:** zapis bez klucza poprzedza notatkę zaczynającą się od `zenc1:` lub `zplain:` prefiksem `zplain:` (zdejmowany przy odczycie), żeby nie wyglądała jak szyfrogram. Stare jawne wiersze zaczynające się od `zenc1:` są nierozróżnialne (nie ma takich na produkcji).
- **Nieczytelny szyfrogram (brak klucza, usunięty kid, zły AAD):** do edytującego klienta wraca `''` i flaga (`noteLocked` / `notesLocked`), nigdy znacznik; eksport, raport i profil pokazują znacznik. Zapis nie nadpisuje takiej kolumny, gdy wejście jest puste albo jest znacznikiem (`planNote`); nowy niepusty tekst ją zastępuje.
- **Zły format klucza:** zapis wpisu (objawy, wpis odmiany, edycja testu) zapisuje resztę i zostawia notatkę bez zmian, odpowiedź 200 z `noteError` (kolejka offline nie utyka na 5xx). Nowy test, recepta z notatką: 422; import pomija wiersz z notatką.
- **Szyfrowanie w miejscu z prefiksem.**
  - Odczyt: tekst bez prefiksu wraca jak jest; brak klucza albo błąd daje „[notatka zaszyfrowana, brak klucza]” i wpis w dzienniku błędów bez treści.
  - Limity długości sprawdzamy w JS na jawnym tekście.
- **Wyjątek `doctor_notes.text`:** ma CHECK 1..200, a szyfrogram jest dłuższy. Wymaga decyzji właściciela:
  - (a) `DROP CONSTRAINT`: luzuje schemat, wyjątek od zasady „tylko addytywnie”;
  - (b) addytywna kolumna `text_enc`.
  - Do decyzji zostaje bez szyfrowania.

## Przepisanie istniejących danych
- **Skrypt `scripts/encrypt-notes.mjs`:**
  - opcje `--dry-run`, `--batch`, `--table`, `--decrypt` (wycofanie);
  - działa porcjami z `UPDATE ... WHERE pk = $ AND col = $stara` (idempotencja, bez nadpisywania równoległych edycji);
  - ten sam skrypt robi rotację klucza;
  - nic nie dzieje się w `ensureDb`.
- **Po przepisaniu:** usunąć stare migawki `backups.data`. PITR i gałęzie Neon mają jawny tekst do końca okna historii.

## Wpływ na funkcje
- Jeden moduł: `lib/data-crypto.js`.
- Zapisy w trasach: wpis odmiany, import, objawy, recepty, testy, „Do omówienia”.
- Odczyty: odmiany (także profil znajomego), raport, statystyki, obserwacje, eksport JSON i CSV (zawsze odszyfrowany).
- **/szukaj:** dziś nie przeszukuje notatek. W przyszłości tylko odszyfrowanie własnych notatek i filtr w JS, nigdy ILIKE.
- **Kopia:**
  - w kopii zostaje szyfrogram, bez klucza;
  - `backup-decrypt --data-key` odszyfrowuje notatki;
  - odtworzenie bez klucza przywraca wszystko poza treścią notatek.
- **Gotowość:** pozycja `data-key` oraz postęp przepisania (liczba jawnych wierszy i wierszy ze starym `kid`). Stan krytyczny, gdy są szyfrogramy, a brak klucza.

## Właściciel
- **Utrata klucza = trwała utrata notatek.** Kopie klucza: menedżer haseł i druga offline, osobno od `BACKUP_ENCRYPTION_KEY`.
- **Kolejność włączania:**
  1. Najpierw gałąź Neon z wdrożeniem podglądu.
  2. Potem produkcja: ustawienie klucza włącza szyfrowanie zapisów.
  3. Na końcu skrypt przepisujący istniejące dane.
- **Wycofanie:** `--decrypt` przed wdrożeniem starego kodu.
