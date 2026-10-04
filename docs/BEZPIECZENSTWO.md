# Bezpieczeństwo: audyt z października 2026 (wersja 0.35.0)

Audyt objął cały kod, nie tylko ostatnie zmiany: aplikację web (Next.js na Vercel), API, bazę, Service Worker i powłokę Android (Capacitor). Testy poprawek są w `tests/db/security-audit.test.js`, `tests/db/security-middleware.test.js`, `tests/security-headers.test.js`, `tests/image-meta.test.js` i `tests/android-manifest.test.js`.

## Model zagrożeń
- **Chronimy:** dane zdrowotne (zużycie, objawy, recepty, zakupy, notatki, testy ze zdjęciami), tożsamość użytkowników (to, że ktoś w ogóle ma konto w aplikacji o medycznej konopi), sesje i hasła.
- **Atakujący:**
  - (1) anonim z internetu: zgadywanie haseł, enumeracja kont, CSRF, clickjacking;
  - (2) zalogowany użytkownik: IDOR, czyli dostęp do cudzych wpisów przez identyfikator; omijanie `can_see`; spam i obciążanie bazy;
  - (3) złośliwa strona otwarta w tej samej przeglądarce: CSRF, XSS przez treści użytkownika;
  - (4) osoba z dostępem do tego samego telefonu lub przeglądarki: cache, `localStorage`, kopia zapasowa Androida;
  - (5) inna aplikacja na telefonie: eksportowana aktywność, intencje.
- **Poza zakresem:** przejęcie konta Vercel, Neon lub GitHub; złośliwy admin (ma z założenia dostęp do kopii); przejęte urządzenie z rootem.

## Ustalenia
Waga: K = krytyczna, W = wysoka, Ś = średnia, N = niska. Status: ✅ naprawione w tym audycie, 👤 do decyzji właściciela, ℹ️ bez zmian (uzasadnienie w kolumnie „Ustalenie”).

| # | Obszar | Ustalenie | Waga | Status | Plik |
|---|---|---|---|---|---|
| 1 | Nagłówki / XSS | Brak pełnego CSP: jedyną obroną przed XSS było escapowanie Reacta. W aplikacji natywnej XSS sięgałby wtyczek (druk, push, biometria). Wdrożony CSP z nonce na każde żądanie: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`. Next.js dokleja nonce do swoich skryptów, layout do skryptu motywu. `CSP_REPORT_ONLY=1` przełącza na tryb raportowania. | Ś | ✅ | `middleware.js`, `lib/security-headers.js`, `app/layout.js` |
| 2 | CSRF | Ochroną była tylko flaga `SameSite=Lax` (bez drugiej warstwy; m.in. logowanie na konto napastnika z obcej strony). Middleware odrzuca POST/PUT/PATCH/DELETE do `/api/*`, gdy `Origin` wskazuje inny host (albo `null`) lub `Sec-Fetch-Site: cross-site`. | Ś | ✅ | `middleware.js` |
| 3 | IDOR / wyciek | Zgłoszenie typu „test” przyjmowało dowolny `ref`. Skutki: admin widział cudzą **prywatną** notatkę z testu, a „usuń treść” kasowało test innej osoby. Teraz test musi należeć do zgłaszanej osoby i być widoczny dla zgłaszającego (`can_see`); widok admina i usuwanie sprawdzają `user_id = target_user_id`. | Ś | ✅ | `app/api/reports`, `app/api/admin/reports` |
| 4 | Enumeracja | Rejestracja sprawdzała zajętość nazwy przed kodem zaproszenia, więc każdy bez zaproszenia mógł sprawdzić, czy ktoś ma konto. Teraz kod jest sprawdzany najpierw (bez zużycia). | Ś | ✅ | `app/api/auth/register` |
| 5 | Enumeracja | Logowanie na nieistniejącą nazwę nie liczyło bcrypt, więc czas odpowiedzi zdradzał, czy konto istnieje. Teraz porównanie ze stałym hashem. | N | ✅ | `app/api/auth/login` |
| 6 | Pliki | Serwer nie sprawdzał zawartości zdjęć ani nie usuwał metadanych. Przeglądarka przekodowuje zdjęcia przez canvas, ale API przyjmie surowy JPEG z EXIF/GPS, a zdjęcie testu widzą znajomi. Teraz zawartość musi pasować do typu, a z plików znikają: APP1/XMP/IPTC/COM z JPEG, tEXt/zTXt/iTXt/eXIf/tIME z PNG oraz EXIF/XMP z WebP. Dotyczy zdjęcia odmiany, testu, awatara i importu z wolnych licencji. | Ś | ✅ | `lib/image-meta.js` + trasy zdjęć, `app/api/profile` |
| 7 | SSRF | Import zdjęć z wolnych licencji szedł za przekierowaniami (`redirect: 'follow'`) pod dowolny adres, a rozmiar był sprawdzany dopiero po pobraniu całości. Teraz najwyżej 3 przekierowania, każde sprawdzane z listą hostów; najpierw sprawdzany jest `content-length`. Adresy licencji i źródła są przyjmowane tylko z https. Trasa jest tylko dla admina, a manifest leży w repozytorium. | N | ✅ | `lib/photo-import.js` |
| 8 | Dostępność RODO | Eksport danych dawał 500 dla nazw z ł, ś, ż, ą, ę, ć, ń, ź: znak spoza Latin-1 w `Content-Disposition` wywraca `Response`. Teraz jest ASCII w `filename` i pełna nazwa w `filename*`. | Ś | ✅ | `app/api/account/export` |
| 9 | Cache | Odpowiedzi API (w tym eksport) nie miały `Cache-Control`. Teraz `safe()` ustawia `no-store`, jeśli trasa nie ustawi własnego. Zdjęcia zachowują `private` i dostają `Vary: Cookie`, więc inna sesja w tej samej przeglądarce nie dostanie ich z cache. Strony HTML mają `no-store` od Next.js. | Ś | ✅ | `lib/guard.js`, `lib/photos.js`, `app/api/users/[id]/avatar` |
| 10 | Wspólne urządzenie | Po wylogowaniu w `localStorage` zostawały ostatnie wyszukiwania (nazwy odmian) i data wizyty u lekarza. Token FCM w aplikacji natywnej dalej dostawał przypomnienia konta. Teraz wylogowanie czyści te klucze i `sessionStorage`, a serwer usuwa token FCM tego urządzenia. | Ś | ✅ | `app/components/LogoutButton.js`, `app/components/deviceData.js`, `app/api/auth/logout` |
| 11 | Android | `allowBackup="true"`: dane WebView, w tym ciasteczko sesji, szły do kopii na Dysku Google i przy przenoszeniu na nowy telefon. Teraz `allowBackup="false"` oraz reguły `dataExtractionRules` (Android 12+, chmura i transfer) i `fullBackupContent`. Dodatkowo `network_security_config`: tylko HTTPS, tylko systemowe CA. | W | ✅ | `mobile/android/app/src/main/AndroidManifest.xml`, `res/xml/*` |
| 12 | Limity | Brak limitu na import CSV (do 200 wierszy po kilka zapytań) i na zgłoszenia. Teraz 20 na godzinę na konto dla każdego z nich. | N | ✅ | `app/api/import`, `app/api/reports` |
| 13 | Wejście | Część identyfikatorów z treści szła przez `Number()`, więc `'abc'` albo 2^40 dawały błąd SQL 500 i wpis w dzienniku błędów. Teraz `intId`. Dotyczy recept, blokad, znajomych, grup, planu admina i zgłoszeń. | N | ✅ | jw. |
| 14 | Logi | Ścieżka w `error_log` zawierała zapytanie (`?q=nazwa odmiany`, daty raportu). Teraz zapisywana jest bez `?` i `#`. | N | ✅ | `lib/errorlog.js` |
| 15 | Cron | Sekret był porównywany zwykłym `!==`. Teraz porównanie w stałym czasie (`cronAuthorized`); bez `CRON_SECRET` jest zawsze odmowa. | N | ✅ | `lib/guard.js`, `app/api/cron/*` |
| 16 | Konto | Usunięcie konta przez admina nie kasowało zdjęć testów z Blob. Teraz kasuje, tak jak samodzielne usunięcie. | N | ✅ | `app/api/admin/users/[id]` |
| 17 | Profil | Błędny awatar zwracał 400 dopiero po zapisaniu reszty profilu. Teraz walidacja odbywa się przed zapisem. | N | ✅ | `app/api/profile` |
| 18 | Build | Po dodaniu middleware (paczka Edge) `instrumentation.js` dociągał `lib/db.js`. Teraz import jest wewnątrz warunku `NEXT_RUNTIME`. | — | ✅ | `instrumentation.js` |
| 19 | Sesje | JWT: HS256 z przypiętym algorytmem, 30 dni, `sv` = `session_version`, token urządzenia na osobnym kluczu z `aud`. Ciasteczko `HttpOnly`, `Secure` (produkcja), `SameSite=Lax`. Limity: logowanie (IP, para IP+nazwa, nazwa), rejestracja, zmiana hasła, usunięcie konta, podpowiedzi AI, OCR apteki, test push. | — | ℹ️ OK | `lib/auth.js` |
| 20 | XSS | Jedyne `dangerouslySetInnerHTML` to stały skrypt motywu (teraz z nonce). Linki użytkownika (profil, źródła odmian) są przyjmowane tylko jako http(s) i mają `rel="noopener noreferrer"`. Wiedza to treść statyczna. | — | ℹ️ OK | |
| 21 | Service Worker | SW cache'uje tylko powłokę (`offline.html`, ikony, manifest), nigdy `/api/` ani stron. Kliknięcie powiadomienia otwiera tylko adres tej samej domeny. | — | ℹ️ OK | `public/sw.js` |
| 22 | Push | Treść domyślnie neutralna, dla FCM zawsze. Endpointy tylko znanych usług push (bez SSRF). Endpointy nie trafiają do eksportu ani kopii. | — | ℹ️ OK | `lib/push.js` |
| 23 | Android | Aktywność jest eksportowana (ikona aplikacji). Dodatek skrótu przechodzi przez `SAFE_PATH`, czyli tylko ścieżkę w obrębie `server.url`. Brak `addJavascriptInterface`. `allowMixedContent: false`, `cleartext: false`. Debugowanie WebView tylko w buildzie debug (domyślne Capacitor). `FileProvider` nieeksportowany. | — | ℹ️ OK | `MainActivity.java`, `capacitor.config.js` |
| 24 | Zależności | `npm audit --omit=dev`: postcss < 8.5.23 (wysoka, w zależnościach `next`). Nie da się tego wykorzystać w działającej aplikacji: postcss działa tylko przy budowaniu, na naszym własnym CSS. Poprawka wymaga Next 16. | N | 👤 | `package.json` |
| 25 | IP | `clientIp()` bierze pierwszy adres z `x-forwarded-for`. Na Vercel jest to wiarygodne, bo platforma nadpisuje ten nagłówek. Poza Vercel (inny hosting za proxy) limity można by obejść. | — | ℹ️ | `lib/ratelimit.js` |

## Wszystkie trasy API (autoryzacja i wynik)
`U` = `requireUser`, `A` = `requireAdmin`, `C` = `CRON_SECRET`, `—` = publiczna. Każda trasa zmieniająca stan przechodzi też przez kontrolę Origin w `middleware.js`.

| Trasa | Metody | Ochrona | Wynik |
|---|---|---|---|
| `auth/login`, `auth/register` | POST | — + limity | OK po #4 i #5 |
| `auth/logout` | POST | sesja opcjonalna | OK, usuwa tylko własny push/FCM |
| `auth/change-password` | POST | `getUser` (celowo: wymuszona zmiana hasła) + limit | OK |
| `account` | DELETE | U + hasło + limit | OK |
| `account/export` | GET | U, tylko własne wiersze | OK po #8 i #9 |
| `export` | GET | U, `listStrains` z `can_see` | OK |
| `strains` | GET, POST | U | OK |
| `strains/[id]` | PATCH, DELETE | U, `intId`; usuwa twórca (gdy odmiana nieużywana) albo admin | OK (wspólna edycja: DT-7, niżej) |
| `strains/[id]/entry`, `effects` | PUT | U, `intId`, tylko własny wiersz | OK |
| `strains/[id]/history` | GET, POST | U / A, `intId`, autor tylko przy `can_see` | OK |
| `strains/[id]/photo` | GET, PUT, DELETE | U, `intId`, podmiana: dodający, autor odmiany albo admin | OK po #6 |
| `strains/[id]/tests` | GET, POST | U, `intId`, `listTests` z `can_see` | OK po #6 |
| `tests/[tid]` | PATCH, DELETE | U, `intId`, autor (DELETE też admin) | OK po #6 |
| `tests/[tid]/photo` | GET | U, `can_see` | OK |
| `strains/[id]/usage`, `purchase` | POST, DELETE | U, `intId`, tylko własne | OK (osobny agent, niżej) |
| `history/usage/[id]`, `history/purchases/[id]`, `history/purchases/fill` | PATCH, DELETE, POST | U, `intId`, `user_id` w każdym zapytaniu | OK |
| `strains/suggest` | POST | U + 15 na dobę + cache | OK |
| `symptoms` | GET, PUT, DELETE | U, tylko własne | OK (uwaga dla osobnego agenta) |
| `prescriptions` | GET, POST, DELETE | U, tylko własne | OK po #13 |
| `profile` | PUT | U | OK po #6 i #17 |
| `users/[id]/avatar` | GET | U, `can_see` profilu | OK po #9 |
| `users/search` | GET | U, z pominięciem blokad | 👤 (lista nazw dla zalogowanych) |
| `friends`, `blocks`, `groups`, `groups/[id]` | GET, POST | U, członkostwo i rola w każdym zapytaniu | OK po #13 |
| `reports` | POST | U | OK po #3 i #12 |
| `notifications`, `options`, `catalog` (GET), `import` | GET, POST | U | OK po #12 |
| `push/config`, `push/prefs`, `push/subscription`, `push/test` | GET, PUT, POST, DELETE | U (test: limit 5 na 10 min) | OK |
| `catalog` (POST), `admin/*`, `backup` | — | A | OK po #3 i #16 |
| `cron/backup`, `cron/catalog`, `cron/reminders` | GET | C | OK po #15 |
| `client-error` | POST | — + 20 na godzinę na IP, długość przycięta | OK |
| `version` | GET | — | OK (wersja i skrót commita) |

Strony serwerowe (`app/**/page.js`) sprawdzają `getUser()` i `must_change_password`. Cudze dane czytają tylko przez `can_see`: profil `/u/[handle]`, grupy, odmiany, rankingi. Raport, obserwacje, historia i dziennik pokazują wyłącznie dane zalogowanej osoby.

## Ryzyka wdrożenia
- **CSP:** sprawdzone na `next build` + `next start`. Każdy `<script>` na stronie ma nonce zgodny z nagłówkiem. Żadna strona HTML nie jest statyczna (statyczna nie miałaby nonce). API i pliki statyczne mają `frame-ancestors 'none'` z `next.config.mjs`. Nie było przeglądarki do testu na żywo.
  - Po wdrożeniu przejrzyj konsolę na podglądzie Vercel (logowanie, odmiana, zdjęcie, raport, push).
  - W razie problemu ustaw `CSP_REPORT_ONLY=1` w zmiennych Vercel i wdróż ponownie (zmiana zmiennej wymaga nowego wdrożenia).
- **CSP w aplikacji Android:** Capacitor wstrzykuje swój skrypt przez `addDocumentStartJavaScript`, którego CSP nie dotyczy. Tylko bardzo stary WebView bez tej funkcji (sprzed ok. 2021, nieaktualizowany) wstawia skrypt do HTML jako inline i CSP go zablokuje: wtedy nie zadziała druk ani push w aplikacji. Nie luzujemy CSP dla aplikacji natywnej, bo tam XSS sięga wtyczek.
- **CSRF:** żądanie bez `Origin` i bez `Sec-Fetch-Site` przechodzi (stare klienty). Przeglądarki wysyłają `Origin` przy każdym POST/PUT/PATCH/DELETE. Zapisy offline (kolejka) muszą iść przez `fetch` z tej samej domeny, tak jak dziś.
- **Zdjęcia:** pliki niezgodne z typem albo uszkodzone są teraz odrzucane (400). Przeglądarka zawsze wysyła JPEG z canvas, więc dotyczy to tylko klientów spoza aplikacji.
- **Android:** `allowBackup=false` oznacza, że po przeniesieniu na nowy telefon trzeba się zalogować ponownie, a ustawienie blokady biometrycznej wraca do domyślnego. Wymaga zbudowania APK; tu sprawdzono tylko statycznie (`tests/android-manifest.test.js`).
- **Wylogowanie:** usuwa token FCM urządzenia, więc po ponownym zalogowaniu w aplikacji natywnej przypomnienia trzeba włączyć ponownie (Profil). Przy błędzie sieci wylogowanie nie udaje sukcesu (ciasteczko HttpOnly usuwa tylko serwer).
- **Zgodność wstecz:** stare sesje i tokeny działają bez zmian (format JWT i ciasteczka nietknięte). Bez migracji bazy.

## Blokada w przeglądarce (POM-25)
Ekran PIN zasłania treść (także przy ukryciu karty); chroni przed przypadkowym wglądem (wspólny komputer, odblokowany telefon), nie przed kimś z dostępem do narzędzi przeglądarki: skrót PIN-u leży w `localStorage`, a 4-8 cyfr da się złamać offline, więc realną barierą są opóźnienia i wylogowanie po 10 błędach, które działają tylko w interfejsie. WebAuthn to lokalne potwierdzenie obecności bez serwera (nie sprawdzamy podpisu). Zasłona w podglądzie przełącznika aplikacji (iOS) zależy od systemu i bywa niepełna. Wylogowanie po bezczynności jest po stronie klienta (wymaga otwartej karty lub kolejnego wejścia); serwerowe wygaszanie sesji to osobna sprawa (lista sesji). Testy: `tests/applock.test.js`.

## Do decyzji właściciela
1. **`AUTH_SECRET` ≥ 32 znaki:** dziś minimum to 16. Wymuszenie w kodzie wyłączyłoby produkcję, jeśli obecny sekret jest krótszy. Zalecenie: sprawdzić w Vercel i w razie potrzeby wymienić; wymiana wyloguje wszystkich.
2. **Prefiks `__Host-` dla ciasteczka sesji:** chroni przed nadpisaniem ciasteczka z subdomeny. Zmiana nazwy wyloguje wszystkich jednorazowo. Ma sens po przejściu na własną domenę.
3. **Unieważnianie pojedynczej sesji po wylogowaniu:** dziś wylogowanie usuwa ciasteczko, a skradziony wcześniej token działa do wygaśnięcia lub do „Wyloguj wszędzie”. Pełne unieważnianie wymaga tabeli sesji (identyfikator w JWT).
4. **Szyfrowanie kopii:** ustawić `BACKUP_ENCRYPTION_KEY`. Bez niego kopie w Blob (wszystkie dane zdrowotne) są tylko skompresowane.
5. **Pobieranie kopii przez admina:** rozważyć ponowne podanie hasła przed `GET /api/backup`. Przejęta sesja admina daje dziś pełny zrzut bazy.
6. **DT-7:** każdy zalogowany edytuje wspólne pola odmian. Jest historia i przywracanie przez admina, ale nie ma zatwierdzania.
7. **Wyszukiwarka użytkowników:** każdy zalogowany może wylistować nazwy kont (po 10 na zapytanie, od 2 znaków). Rozważyć wyszukiwanie tylko po pełnej nazwie albo limit.
8. **Next 16:** usuwa ostrzeżenie o postcss (#24) i daje nowsze poprawki bezpieczeństwa. To osobne zadanie z testami.
9. **HSTS `includeSubDomains; preload`:** dopiero przy własnej domenie.
10. **`FileProvider` z `external-path "."`:** pochodzi z szablonu Capacitor i nie jest eksportowany. Można zawęzić do `cache-path`, jeśli nic poza drukiem go nie używa (sprawdzić przy następnym buildzie APK).

## Dla prac nad kolejką offline (pliki poza tym audytem)
- Wpisy w IndexedDB trzeba wiązać z id użytkownika i czyścić przy wylogowaniu: miejsce na to to `clearDeviceData()` w `app/components/deviceData.js`, wołane z `LogoutButton.js` i `ProfileForm.js` (te pliki zmienił audyt, przy scalaniu uwaga na konflikty). Inaczej na wspólnym telefonie zużycie lub objawy osoby A wyślą się na konto osoby B.
- `DELETE /api/symptoms`: `String(day)::date` bez walidacji. Błędna data daje 500 i wpis z treścią wejścia w `error_log`; potrzebna walidacja jak w PUT.
- Odtwarzanie kolejki musi wysyłać żądania z tej samej domeny (`fetch` ze strony lub Service Workera). Inaczej odrzuci je kontrola Origin w `middleware.js`.
- `safe()` dodaje teraz `Cache-Control: no-store` do odpowiedzi wszystkich tras (także `usage`, `purchase`, `symptoms`), jeśli trasa nie ustawi własnego; kolejka nie powinna opierać się na cache HTTP.
