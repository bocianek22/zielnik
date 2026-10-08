# Przegląd gotowości do 1.0 (8.10, wersja 0.50.0)

Przegląd całego kodu (Opus): 80 tras API, prywatność, niezawodność, dostępność, lista kontrolna 1.0. Nie znaleziono IDOR. Wszystkie trasy mają `safe()`, uwierzytelnienie i `intId`, a migracje są addytywne.

## Blokujące przed otwartą betą
1. **Wstrzyknięcie formuł w CSV** (`app/api/export/route.js`). Nazwy, producenci i smaki odmian ze wspólnego katalogu nie są neutralizowane (`= + - @`). Poprawka: [C].
2. **Brak limitów i moderacji treści wspólnych:**
   - nowe odmiany, opcje, testy ze zdjęciem, zaproszenia do znajomych, recepty;
   - zgłaszania nie obsługują odmian, opcji ani zdjęć odmian.

   Poprawka: [C].
3. **Otwarta rejestracja** (flaga, ochrona przed botami, potwierdzony e-mail) nie istnieje. Blokuje tylko wtedy, gdy otwarta beta ma być bez zaproszeń. Decyzja: [W].
4. **Dane zdrowotne mogą być przetwarzane w USA:** funkcje Vercel działają w `iad1`, region Neon jest do potwierdzenia. Decyzja: [W], potem [C] (`regions` w `vercel.json`, polityka prywatności).

## Ważne
5. **Kopie:**
   - kopia raz w tygodniu (do 7 dni utraty danych), wystarczy cron dzienny [C];
   - zdjęcia testów i odmian nie trafiają do kopii [C, osobno].
6. **Błędne JSON w logowaniu, zmianie hasła i panelu admina** dają 500 jeszcze przed limitem prób i zaśmiecają dziennik błędów. Poprawka: [C].
7. **Wieczorne przypomnienie o objawach** działa tylko z cronem co godzinę (Vercel Pro). Do czasu przejścia na Pro: [C] ukryć je albo opisać w UI.
8. **Wyszukiwarka użytkowników** ignoruje prywatność profilu. Poprawka: [C].
9. **Admin:** pełny zrzut bazy (`GET /api/backup`) bez ponownego podania hasła. Poprawka: [C] ponowne hasło. TOTP: decyzja [W].
10. **Retencja (PRA-5):** nieaktywne konta, `audit_log`, kopie 84 dni. Decyzja: [W] z prawnikiem.

## Drobne
- Usunięcie konta bez transakcji.
- Adres subskrypcji Web Push: dowolny URL https (SSRF). Potrzebna lista dozwolonych hostów.
- Średnia cena liczona bez `can_see`. Ryzyko niewielkie: wymagane są co najmniej 3 ceny.
- Budżety wydajności obejmują tylko `/login` i `/`.
- `ROADMAP.md` jest nieaktualny (wersja i lista kontrolna).
- Dostępność:
  - brak ręcznych testów z TalkBack i VoiceOver;
  - brak testu powiększenia czcionki do 130-200%;
  - panele admina bez skanu axe;
  - menu „+” bez obsługi strzałek.

## Lista kontrolna 1.0
| Pozycja | Stan |
|---|---|
| KON-1 e-mail | kod gotowy; konto Resend i domena: właściciel |
| KON-3 Google | brak (domena, OAuth) |
| PRA-1/2/3 | wersje robocze; prawnik |
| PLA-1 testy | zrobione |
| PLA-2 monitoring | kod gotowy; zewnętrzny monitor: właściciel |
| PLA-3 Vercel Pro | właściciel |
| PLA-7 kopie | zrobione; klucz, cron dzienny, zdjęcia |
| KAT-1 | zrobione |
| KAT-4 Wiedza | prawnik i przegląd merytoryczny |
| MON-1 | decyzja właściciela |
| PLA-8 bezpieczeństwo | częściowo (punkty 1, 2, 6; Next 16) |
| UX-2 dostępność | częściowo (axe w CI; ręczne testy z czytnikiem ekranu) |
| Rejestracja | zaproszenia; otwarta: niezrobiona |

## Decyzje właściciela
1. Otwarta rejestracja czy zaproszenia.
2. Regiony Vercel i Neon w UE.
3. Vercel Pro.
4. Klucze: `BACKUP_ENCRYPTION_KEY`, `DATA_ENCRYPTION_KEY`, `AUTH_SECRET` (co najmniej 32 znaki).
5. TOTP dla admina.
6. Next 16.
7. Retencja i czyszczenie nieaktywnych kont.
8. Prawnik: PRA-1/2/3 i KAT-4.
9. Płatności (MON-1).
10. Szyfrowanie `doctor_notes.text`: zdjąć CHECK 200 znaków czy dodać kolumnę `text_enc`.
