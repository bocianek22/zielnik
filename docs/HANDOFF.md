# Przekazanie prac (dla kolejnego programisty i Claude)

Aktualizuj ten plik przy każdym wydaniu. Sekcja „Następne kroki” ma zawsze odpowiadać stanowi projektu.

## 1. Stan projektu
- Aplikacja **Zielnik**: dziennik odmian medycznej konopi dla pacjentów (Next.js 15 na Vercel, baza Neon Postgres). Zamknięta beta, rejestracja z kodem zaproszenia.
- Bieżąca wersja: patrz `package.json` i `CHANGELOG.md`. Kod: GitHub `bocianek22/zielnik`, hosting: projekt Vercel `zielnik`.
- Konto admina: `Bocian`. Ustawienia (zmienne środowiskowe) opisuje `docs/ARCHITEKTURA.md`.
- Dokumenty: `ROADMAP.md` (plan wg działów i wersji), `CHANGELOG.md`, `CONTRIBUTING.md` (commity, wersje, wydania), `docs/ARCHITEKTURA.md`.

## 2. Jak zacząć nową rozmowę z Claude
**Zalecane (od 0.28.2): Claude Code na claude.ai/code** z podłączonym repozytorium `bocianek22/zielnik`. Claude pracuje wtedy bezpośrednio na gałęzi w git, instaluje pakiety, uruchamia `npm run check`, `npm test`, `npm run test:db` (lokalny PostgreSQL) i `next build`, a zmiany trafiają przez Pull Request sprawdzany przez CI i podgląd Vercel. Odpada ręczne wgrywanie folderów przez github.dev, które dwukrotnie skasowało pliki (sekcja 4). Zasady pracy z sekcji 3 dotyczące paczek ZIP przestają wtedy obowiązywać.

Tryb awaryjny (rozmowa bez dostępu do repozytorium):
1. Na GitHubie: Code → Download ZIP. Wgraj ten plik do rozmowy.
2. Wklej prompt startowy (niżej).
3. Claude pracuje w piaskownicy bez dostępu do sieci: nie zainstaluje pakietów npm, nie połączy się z bazą i nie wdroży aplikacji. Zwraca paczkę ZIP ze zmianami, a Ty wgrywasz ją na GitHub (Add file → Upload files).

**Prompt startowy (do wklejenia):**
> Kontynuujemy projekt „Zielnik” (Next.js + Neon, repozytorium w załączonym ZIP-ie). Przeczytaj `docs/HANDOFF.md`, `ROADMAP.md`, `CHANGELOG.md`, `CONTRIBUTING.md` i `docs/ARCHITEKTURA.md`. Zasady: odpowiadaj po polsku; małe, bezpieczne kroki; po każdej zmianie uruchom `node scripts/check.js` i `npm test`; zaktualizuj `CHANGELOG.md`, podnieś wersję w `package.json` i sekcję „Następne kroki” w `docs/HANDOFF.md`; oddaj paczkę `zielnik-vX.Y.Z.zip` zawierającą CAŁE foldery najwyższego poziomu, w których cokolwiek się zmieniło (np. cały `app/` i/lub `lib/`), oraz zmienione pliki z katalogu głównego; wgrywam je przez github.dev, usuwając najpierw stary folder, a dopiero potem wrzucając nowy (nigdy nie przeciągam folderu na istniejący folder o tej samej nazwie) oraz sugerowany komunikat commita w formacie Conventional Commits. Na końcu każdej odpowiedzi podaj krótko następne kroki. Zaczynamy od: [wpisz zadanie z ROADMAP, np. MOB-3].

## 3. Zasady pracy (skrót)
- Paczka zawiera **całe foldery najwyższego poziomu**, w których coś się zmieniło (`app/`, `lib/`), plus zmienione pliki z katalogu głównego (`package.json`, `CHANGELOG.md`). Wgrywanie pojedynczych plików do podfolderów kilkukrotnie kończyło się plikami w złych miejscach albo utraconymi plikami (sekcja 4). Procedura wgrania: github.dev (klawisz `.` na stronie repo), kliknij nazwę repo na górze drzewa, usuń stary folder i poczekaj aż zniknie, przeciągnij nowy folder na korzeń drzewa, rozwiń go i sprawdź liczbę plików (np. `app/layout.js`, `lib/api.js`), dopiero potem commit z krótkim opisem (nie wklejaj tam kodu).
- Po wgraniu: Vercel → Deployments (status READY), potem logi runtime i sekcja „Dziennik błędów” w panelu admina.
- Zmiany bazy tylko addytywne i idempotentne w `lib/db.js` (`ensureDb`).

## 4. Pułapki (wyciągnięte wnioski)
- Skrypty poprawek w Pythonie: jeśli w którymś napisie jest niewyescapowany cudzysłów, cały skrypt kończy się błędem składni i żadna podmiana się nie wykonuje, a kolejne polecenia w tej samej powłoce (np. commit) mimo to się wykonują. Stosuj potrójne cudzysłowy, łącz polecenia przez `&&`, po podmianie weryfikuj efekt (`grep`), a linie z polskimi cudzysłowami zmieniaj po numerze linii (`sed -i 'NUMs/.*/nowa linia/'`).
- Podmiany tekstu mają być atomowe: najpierw wszystkie dopasowania w pamięci (przerwij przy niedopasowaniu), dopiero potem zapis plików.
- **KRYTYCZNE w github.dev: przeciągnięcie folderu na już istniejący folder o tej samej nazwie ZASTĘPUJE go całkowicie** (usuwa pliki, których nie ma w nowym folderze), zamiast scalić zawartość. Zdarzyło się to dwa razy w tej sesji (app/admin i lib straciły większość plików). Zawsze: 1) usuń stary folder w drzewie (prawy klik → Delete), 2) dopiero wtedy przeciągnij nowy folder w puste miejsce, 3) rozwiń go i policz pliki przed commitem.
- **Kontrola składni (esbuild) NIE wykrywa literówki `(x) = wartość` zamiast `(x) => wartość`** - to poprawny JS (przypisanie do zmiennej), tylko błędny semantycznie, i wybucha dopiero w runtime jako `ReferenceError: x is not defined`. Po każdej automatycznej edycji funkcji strzałkowych sprawdzaj: `grep -nE "\([a-zA-Z_]+\) = [^=>]" plik` (bez `=>` i bez `==`).
- Gdy użytkownik zgłasza błąd z kodem: najpierw sprawdź Vercel -> Deployments (czy w ogóle powstał nowy deploy) i logi runtime konkretnego `deploymentId` - to daje dokładny stack trace zamiast zgadywania.
- Bez `npm install` (brak sieci w piaskownicy) nie da się uruchomić prawdziwego lintera (`eslint` z regułą `no-undef`) - `scripts/check.js` i `esbuild --loader=jsx` łapią tylko część błędów (patrz punkt wyżej).
- Przy dodawaniu stanu (`useState`) do pliku najpierw sprawdź `grep -n "useState(" plik`, żeby nie zadeklarować dwa razy tej samej nazwy (zdarzyło się z `limit` w `StrainsBoard.js`, 0.19.0).
- Ta paczka (`zielnik-v0.22.1.zip`) zawiera **skumulowane zmiany od v0.17.0** (ostatniej wersji, o której wiadomo, że została wgrana): 0.17.1, 0.18.0, 0.19.0, 0.20.0, 0.21.0, 0.22.0, 0.22.1. Wgraj ją w całości.
- Po wgraniu: na telefonie kliknij „Dodaj odmianę” i sprawdź, czy arkusz zajmuje cały ekran, pasek u góry jest przyklejony, a „← Wróć” zamyka formularz bez zapisu.
- Po wgraniu 0.21.0: przełącz tryb ciemny na telefonie i na komputerze, sprawdź kontrast tekstu na kartach, plakietkach i w formularzach — zgłoś, co jest nieczytelne (kolory łatwo poprawić w `:root[data-theme="dark"]` w `app/globals.css`).
- Po wgraniu 0.20.0 sprawdź w Vercel, czy `/sw.js` i `/offline.html` są dostępne publicznie (folder `public/`, bez logowania) — inaczej offline nie zadziała.
- Zdjęcia otwieraj komponentem `app/components/Lightbox.js` (pełny ekran, przycisk ×), nigdy linkiem `target="_blank"` do pliku obrazu — na telefonie nie ma jak z tego wrócić.
- **Brakujący plik po wgraniu** psuje stronę (były przypadki `knowledge.js`, `dailyUse`). `node scripts/check.js` wykrywa brakujące pliki i eksporty. Uruchamiaj zawsze.
- W `app/api/**/route.js` nie eksportuj niczego poza metodami HTTP i opcjami Next.js (skrypt kontrolny to sprawdza).
- Przebudowując plik, nie kasuj cudzych funkcji: po zmianie sprawdź listę eksportów (`grep -n "^export" plik`).
- Widoczność treści (`can_see` w `lib/db.js` i `lib/strains.js`) wpływa na całą aplikację. Każda zmiana wymaga ręcznego testu na dwóch kontach (znajomi, blokada).
- W zapytaniach `INSERT ... SELECT` z parametrami dodawaj rzutowania (`::int`, `::numeric`), inaczej PostgreSQL zgłosi błąd typu.
- Wszystkie zapytania SQL były pisane bez uruchomienia. Nowe funkcje testuj po wgraniu i patrz w „Dziennik błędów”.
- Nowa treść użytkownika = zapis w eksporcie danych (`app/api/account/export`), kopii zapasowej (`lib/backup.js`) i uwzględnienie w `can_see`.
- Dolny pasek i górne menu mają zduplikowaną listę pozycji (`BottomNav.js`, `Header.js`), zmieniaj oba (MOB-17).

## 5. Decyzje i zadania po stronie właściciela
- Zakup domeny, potem usługa e-mail (odzyskiwanie hasła), konta Google i Apple do logowania.
- Konsultacja z prawnikiem (RODO, reklama produktów leczniczych i aptek) i księgowym; przegląd regulaminu i polityki prywatności.
- Wybór bramki płatności i platformy wpłat (`DONATE_URL`), decyzja o `PREMIUM_ENFORCED`.
- Źródło danych do katalogu (`CATALOG_FEED_URL`), plan Vercel Pro przy działalności komercyjnej.

## 6. Następne kroki (aktualne dla wersji 0.41.0)
Pełna lista z uzasadnieniem: `docs/PRZEGLAD-2026-10.md`; aplikacje natywne: `docs/APLIKACJE-NATYWNE.md`; system projektowy: `docs/DESIGN.md`. Praca z podziałem na subagentów (`.claude/agents/`): koordynator scala gałęzie, uruchamia kontrole, zleca przegląd (reviewer) i prowadzi CHANGELOG/wersję. Przebieg pracy nocnej: `docs/PLAN-NOC.md`.
1. **Ręcznie na telefonie (0.41.0):** panel „Dziś” bez zapisu zużycia dziś: „Dziś bez zużycia”, „Cofnij”, po „Zużyłem” przycisk znika; „Moje obserwacje” po pierwszym oznaczeniu (opis grupy „Dni bez zużycia”); CSV z wierszem „Bez zużycia”.
1. **Ręcznie na telefonie (0.40.0):** profil → „Blokada i bezpieczeństwo” → „Zmień PIN” (zły obecny PIN, zmiana, odblokowanie nowym PIN-em, odcisk palca nadal działa); logowanie i rejestracja bez zmian w działaniu.
1. **Ręcznie na telefonie (0.39.0):** dziennik → „Własne objawy”: dodanie (do 3), zmiana nazwy i kierunku, usunięcie; wpis w panelu „Dziś” (także offline) i w dzienniku, wykres, „Moje obserwacje”, raport (opisowo), CSV w Excelu (nowa ostatnia kolumna), tryb dyskretny; ekran główny na wolnej sieci: panel „Dziś” przed listą, bez skoków układu, „Zużyłem” w panelu zaraz po otwarciu. Następne wydanie według `docs/POMYSLY.md` (rekomendacje 0.40.0: Lighthouse w CI, `safe()` w change-password, „Zmień PIN”).
1. **Ręcznie na telefonie (0.38.0):** profil → „Sesje”: lista urządzeń (APK jako „Aplikacja Zielnik, Android”), wylogowanie pojedynczej sesji (na drugim urządzeniu następne odświeżenie prowadzi do logowania), „Wyloguj inne urządzenia”; profil → „Blokada i bezpieczeństwo”: PIN, odcisk/twarz (Android Chrome, iOS Safari/PWA), blokada po powrocie do karty po 1 min, zasłona w przełączniku aplikacji (iOS bywa niepełna), ekran blokady w trybie dyskretnym, wylogowanie po bezczynności. Do decyzji: limit 50 aktywnych sesji na konto.
1. **Ręcznie na telefonie (0.37.0):** „Sposób i pora” w panelu „Zużyłem” (390 px, jasny/ciemny), korekta sposobu i pory w Historii, CSV dziennika w Excelu PL (polskie znaki, kolumny, przecinek), nazwa pliku w trybie dyskretnym, nowe konto: jeden przycisk „Dodaj odmianę” otwiera formularz.
1. **Ręcznie na telefonie (0.36.0):** tryb samolotowy w PWA i APK („Zużyłem”, „Wykupiłem”, objawy, licznik „czeka”, powrót sieci, jeden wpis w bazie), zamknięcie aplikacji z czekającymi zapisami, wylogowanie z kolejką; nowe APK: „Udostępnij / Zapisz PDF” w raporcie, skróty pod ikoną (z zamkniętej aplikacji i z tła, z blokadą biometrią), wersja aplikacji 0.3.0; konsola przeglądarki bez błędów CSP. Decyzje bezpieczeństwa: `docs/BEZPIECZENSTWO.md`.
1. **Ręcznie na telefonie (0.35.0):** „Moje obserwacje” (przełączanie objawów i okresów, tryb dyskretny), raport: „Udostępnij / Zapisz PDF” w Chrome na Androidzie i w iOS (w APK `window.print()` może nie działać - wtedy potrzebne rozwiązanie natywne), „Od ostatniej wizyty” po ponownym otwarciu aplikacji, admin: „Dodaj zdjęcia z wolnych licencji” (zdjęcie Pink Kush pochodzi z Flickra - sprawdzić, czy się pobiera).
1. **Ręcznie na telefonie (0.34.0):** podpowiedzi wyszukiwania (pole na liście odmian przesuwa się do góry, lista mieści się nad klawiaturą w aplikacji Android; tryb dyskretny), jednostki ml (przełącznik g/ml na wykresie „Dziś” przy 320 px, „Zużyłem” 0,25 ml i „Cofnij”, „Wykupiłem” dla pena 0,45/0,9 ml, jednostka w nowej recepcie, korekta wpisu w ml, wydruk raportu). Jednorazowo po wdrożeniu (tylko jeśli pule olejów/penów się rozjechały):
   ```sql
   INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
   SELECT up.user_id, pool_key(s.id, s.producer, s.thc, s.cbd, s.form), up.remaining_to_buy
   FROM user_pool up JOIN strains s ON up.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd)
   WHERE s.form <> 'susz' AND s.thc IS NOT NULL
   ON CONFLICT (user_id, pool_key) DO UPDATE SET remaining_to_buy = EXCLUDED.remaining_to_buy;
   ```
1. **Ręcznie na telefonie (0.33.0):** „Cofnij” po „Zużyłem”/„Wykupiłem” (8 s), korekta wpisu w Historii (zapas i „do wykupienia” po zmianie gramów, uzupełnienie brakujących cen), szybki wpis objawów w „Dziś”, „Zdjęcie z apteki → CSV” w panelu admina (po ustawieniu klucza), „Pobierz CSV” w aplikacji Android.
1. **Ręcznie na telefonie (0.32.0):** panel „Dziś” (dotknięcie słupków wykresu, „Zużyłem” z panelu, pilna recepta nad zapasem), szczegóły odmiany (przesuwanie palcem po wykresie a przewijanie strony, zdjęcie i podgląd w aplikacji, wyrównanie ocen na 320 px - `subgrid` w Android WebView), tryb dyskretny w panelu i nagłówku odmiany. Właściciel może scalać sam; Claude scala PR po zielonym CI.
2. **Ręcznie na telefonie (0.31.0):** wpisanie „0,5” w zużyciu i „1,5” w THC zapisuje 0,5 i 1,5; karta na wąskim ekranie (320 px); wklejanie po przytrzymaniu pola tekstowego w APK; przytrzymanie linku nie otwiera menu; jedna wibracja na przełącznikach; zakładki admina po resecie hasła; tryb dyskretny w profilu publicznym, grupie, raporcie (wydruk z nazwami); link z rozmytą nazwą przy pierwszym dotknięciu tylko odsłania.
3. **Właściciel - ustawienia w Vercel:**
   - Zdjęcia w Blob (PLA-4): po scaleniu `PHOTOS_BLOB=1`, sprawdzić dodanie zdjęcia; potem migracja starych zdjęć (`scripts/photos-to-blob.js`, najpierw `--dry-run`, `--limit=5`, po kopii bazy). Rozważyć osobny magazyn Blob na zdjęcia (dziś ten sam co kopie).
   - Zdjęcie z apteki → CSV (panel admina, zakładka System): `ANTHROPIC_API_KEY` (klucz z console.anthropic.com, ten sam co dla podpowiedzi z internetu); opcjonalnie `ZIELNIK_VISION_MODEL` (domyślnie `claude-opus-5-5`). Sprawdzić na telefonie: zdjęcie aparatem i z galerii, poprawki w tabeli, „Importuj do katalogu”, „Pobierz CSV” w APK (gdy pobieranie nie działa w WebView, jest „Kopiuj CSV”).
   - gdziepolek.pl: kliknąć „Sprawdź dostępność w aptekach” przy odmianie i w katalogu; adres wyszukiwarki (`https://www.gdziepolek.pl/szukaj?q=`) nie był potwierdzony automatycznie, w razie błędu poprawić stałą `GDZIEPOLEK_SEARCH` w `lib/pharmacies.js`.
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:...` (z `node scripts/vapid-keys.js`) - bez nich push jest wyłączony.
   - `BACKUP_ENCRYPTION_KEY` (`openssl rand -base64 32`, kopia klucza w menedżerze haseł) - zalecane, kopie zawierają dane zdrowotne. `BLOB_READ_WRITE_TOKEN` już ustawiony (magazyn `zielnik-kopie`, prywatny, fra1).
   - Osobna gałąź bazy Neon dla podglądów (PLA-3): dziś podglądy działają na produkcyjnej bazie.
   - Region funkcji: dziś `iad1` (USA). Jeśli baza Neon jest w UE, ustawić `"regions": ["fra1"]` w `vercel.json` (opóźnienia i RODO).
4. **Aplikacje natywne (MOB-16):** APK budowany w CI. Właściciel: keystore i sekrety `ANDROID_KEYSTORE_*`, projekt Firebase (`GOOGLE_SERVICES_JSON` w GitHub, `FIREBASE_SERVICE_ACCOUNT` w Vercel - wysyłka FCM jest gotowa, czeka na klucz; instrukcja w `mobile/README.md`). Dalej: test push na telefonie, Google Play (12 testerów × 14 dni przy koncie prywatnym), iOS po założeniu konta Apple.
5. **Dług UI:** ostrzeżenia ESLint (`npm run lint`, w CI jako ostrzeżenia) `react-hooks/set-state-in-effect` w `UsersAdmin`, `BottomNav`, `StrainCard`, `StrainsBoard`, `ThemeToggle` oraz `react-hooks/refs` w `StrainCard`; pole progu „Kończy się” w `StrainsBoard` i pola admina zostały `type="number"`.
6. **Z przeglądu 0.30.0 (niski priorytet):** idempotencja szybkich akcji przy ponowieniu po zerwanym połączeniu; przypomnienia o recepcie codziennie przez 8 dni (rozważyć progi 7/3/1/0); subskrypcja push na wspólnym urządzeniu po wygaśnięciu sesji; zakres kopii (kody zaproszeń, zgłoszenia); zdjęcia odmian po usunięciu konta (RODO).
7. **Dalej:** KAT-1 krok 2 (propozycje zmian katalogu), PLA-5 (paginacja po stronie UI), PLA-4 (zdjęcia w Blob), pełny CSP (PLA-8), po zakupie domeny: KON-1, KON-3, MON-1.

**Znane ograniczenia wdrożeniowe:**
- *Wycofanie do < 0.30.0*: najpierw SQL z sekcji „Uwaga przy wycofaniu wdrożenia” w CHANGELOG 0.30.0 (stary kod wymaga wpisów `user_strain` dla wszystkich par); do < 0.29.0 dodatkowo unieważnione sesje znów działają.
- *Podglądy na wspólnej bazie*: wersje z różnym schematem nadpisują `schema_meta` (pełna migracja przy każdym zimnym starcie).
- `SCHEMA_REV` w `lib/db.js`: suma kontrolna widzi tylko treść SQL w `init()`; zmiana samej logiki JS wymaga ręcznego podbicia.
