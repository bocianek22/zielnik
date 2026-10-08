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
| 19 | Sesje | JWT: HS256 z przypiętym algorytmem, 30 dni, `sv` = `session_version`, `sid` = wiersz w `sessions` (#26), token urządzenia na osobnym kluczu z `aud`. Ciasteczko `HttpOnly`, `Secure` (produkcja), `SameSite=Lax`. Limity: logowanie (IP, para IP+nazwa, nazwa), rejestracja, zmiana hasła, usunięcie konta, podpowiedzi AI, OCR apteki, test push. | — | ℹ️ OK | `lib/auth.js` |
| 20 | XSS | Jedyne `dangerouslySetInnerHTML` to stały skrypt motywu (teraz z nonce). Linki użytkownika (profil, źródła odmian) są przyjmowane tylko jako http(s) i mają `rel="noopener noreferrer"`. Wiedza to treść statyczna. | — | ℹ️ OK | |
| 21 | Service Worker | SW cache'uje tylko powłokę (`offline.html`, ikony, manifest), nigdy `/api/` ani stron. Kliknięcie powiadomienia otwiera tylko adres tej samej domeny. | — | ℹ️ OK | `public/sw.js` |
| 22 | Push | Treść domyślnie neutralna, dla FCM zawsze. Endpointy tylko znanych usług push (bez SSRF). Endpointy nie trafiają do eksportu ani kopii. | — | ℹ️ OK | `lib/push.js` |
| 23 | Android | Aktywność jest eksportowana (ikona aplikacji). Dodatek skrótu przechodzi przez `SAFE_PATH`, czyli tylko ścieżkę w obrębie `server.url`. Brak `addJavascriptInterface`. `allowMixedContent: false`, `cleartext: false`. Debugowanie WebView tylko w buildzie debug (domyślne Capacitor). `FileProvider` nieeksportowany. | — | ℹ️ OK | `MainActivity.java`, `capacitor.config.js` |
| 24 | Zależności | `npm audit --omit=dev`: postcss < 8.5.23 (wysoka, w zależnościach `next`). Nie da się tego wykorzystać w działającej aplikacji: postcss działa tylko przy budowaniu, na naszym własnym CSS. Poprawka wymaga Next 16. | N | 👤 | `package.json` |
| 25 | IP | `clientIp()` bierze pierwszy adres z `x-forwarded-for`. Na Vercel jest to wiarygodne, bo platforma nadpisuje ten nagłówek. Poza Vercel (inny hosting za proxy) limity można by obejść. | — | ℹ️ | `lib/ratelimit.js` |
| 26 | Sesje (POM-27) | Wylogowanie usuwało tylko ciasteczko: skopiowany wcześniej token działał do wygaśnięcia albo „Wyloguj wszędzie”. Teraz JWT ma `sid`, a `getUser` wymaga aktywnego wiersza w `sessions` (obok `sv`). Wylogowanie unieważnia bieżącą sesję. W profilu jest lista „Zalogowane urządzenia” z wylogowaniem pojedynczej sesji i „Wyloguj inne urządzenia” (podnosi `sv`, bieżąca dostaje nowy token z tym samym `sid`). Zmiana hasła działa tak samo, a reset przez admina i „wyloguj wszędzie” unieważniają wszystkie wiersze. Zapisujemy opis urządzenia („Chrome, Android”), flagę aplikacji natywnej i kraj z `x-vercel-ip-country`. Nie zapisujemy IP ani pełnego User-Agent. `last_used_at` jest aktualizowane najwyżej co 15 min. Przy logowaniu usuwane są wygasłe wiersze, a aktywnych sesji jest najwyżej 50 na konto. Limit: 30 wylogowań na 15 min. Tabela poza kopią, eksport bez `sid`. | Ś | ✅ | `lib/auth.js`, `app/api/account/sessions`, `app/profil/Sessions.js` |

## Wszystkie trasy API (autoryzacja i wynik)
`U` = `requireUser`, `A` = `requireAdmin`, `C` = `CRON_SECRET`, `—` = publiczna. Każda trasa zmieniająca stan przechodzi też przez kontrolę Origin w `middleware.js`.

| Trasa | Metody | Ochrona | Wynik |
|---|---|---|---|
| `auth/login`, `auth/register` | POST | — + limity | OK po #4 i #5 |
| `auth/logout` | POST | sesja opcjonalna | OK, usuwa tylko własny push/FCM; unieważnia bieżącą sesję (#26) |
| `auth/change-password` | POST | `getUser` (celowo: wymuszona zmiana hasła) + limit | OK |
| `auth/forgot` | POST | — + limity: 10 na 15 min na IP, 5 na godzinę na wpisany tekst (429); 3 na godzinę na konto i na adres (po cichu, bez 429) | KON-1: zawsze ta sama odpowiedź i czas ≥ 400 ms, wysyłka po odpowiedzi (`after()`); 503 przy wyłączonej wysyłce |
| `auth/reset` | POST | — + 20 na 15 min na IP; token jednorazowy | KON-1: hasło 8-100 znaków, unieważnia wszystkie sesje (`revokeSessions`) |
| `account/email` | GET, PUT, DELETE | U; PUT: hasło + zgoda + 5 na godzinę na konto, 3 maile na godzinę na adres (po cichu) | KON-1: adres tylko właściciela |
| `account/email/verify` | POST | — + 20 na 15 min na IP; token jednorazowy związany z adresem | KON-1 |
| `account` | DELETE | U + hasło + limit | OK |
| `account/export` | GET | U, tylko własne wiersze | OK po #8 i #9 |
| `account/sessions` | GET, DELETE | U; DELETE (wyloguj inne) + limit 30 na 15 min | OK po #26 |
| `account/sessions/[id]` | DELETE | U, `sid` sprawdzany wzorcem `SID_RE` zamiast `intId` (identyfikator tekstowy), tylko własna aktywna sesja (inaczej 404) + limit | OK po #26 |
| `export` | GET | U, `listStrains` z `can_see` | OK |
| `strains` | GET, POST | U | OK |
| `strains/[id]` | PATCH, DELETE | U, `intId`; PATCH: bezpośrednio admin lub twórca nieużywanej odmiany, inni dostają propozycję (202); usuwa twórca (gdy odmiana nieużywana, `strain_used_by_others`) albo admin | OK (DT-7 zamknięte) |
| `proposals`, `proposals/[id]` | GET, DELETE | U, `intId`, tylko własne (`user_id` w zapytaniu), DELETE tylko oczekująca | OK |
| `admin/proposals` | GET, POST | A (`requireAdmin`), `intId`, przyjęcie atomowe (status + konflikt w jednym UPDATE), wpis w audycie | OK |
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
| `admin/alerts` | GET, POST | A; POST (alert próbny) 3 na 10 min | PLA-2 |
| `cron/backup`, `cron/catalog`, `cron/reminders` | GET | C | OK po #15 |
| `client-error` | POST | — + 20 na godzinę na IP, długość przycięta | OK; źródło „przeglądarka” nie wywołuje alertów (PLA-2) |
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
- **E-mail i alerty (KON-1, PLA-2):** bez nowych zmiennych nic się nie zmienia (funkcje ukryte). Po ustawieniu `RESEND_API_KEY` i `MAIL_FROM` ustaw też `APP_URL`; bez niego linki działają tylko z domen Vercel i `APP_HOSTS`. Wyzwalacz `users_email_tokens_invalidate` wymaga PostgreSQL 14+ (Neon: 16). Wycofanie wdrożenia: stary kod ignoruje nowe kolumny i tabelę. `after()` przenosi wysyłkę za odpowiedź; poza zakresem żądania (np. `onRequestError`) alert jest wysyłany przed końcem obsługi.
- **Zgodność wstecz (audyt 0.35):** stare sesje i tokeny działały bez zmian (format JWT i ciasteczka nietknięte), bez migracji bazy. Od POM-27 JWT ma `sid` i jest tabela `sessions` (niżej).
- **Sesje (#26, POM-27):**
  - **Tokeny sprzed `sid`:** są przyjmowane do wygaśnięcia, czyli najwyżej 30 dni, więc wdrożenie nikogo nie wylogowuje. Przy pierwszym użyciu dostają wiersz o stałym identyfikatorze ze skrótu tokenu. Wtedy są na liście urządzeń i można je wylogować pojedynczo; unieważniony wiersz zostaje do wygaśnięcia. Tokeny, które nie wróciły na serwer po wdrożeniu, unieważnia „Wyloguj inne urządzenia”, zmiana hasła i „wyloguj wszędzie” (podniesienie `sv`). Wybraliśmy to zamiast wymuszenia ponownego logowania, bo wymuszenie wylogowałoby wszystkich naraz, także w aplikacji natywnej.
  - **Wycofanie wdrożenia:** stary kod nie sprawdza `sessions`. Pojedynczo wylogowane sesje działałyby wtedy znowu, aż do wygaśnięcia albo podniesienia `sv`.
  - **Odtworzenie bazy z kopii:** tabela `sessions` nie jest w kopii, więc po odtworzeniu każdy loguje się ponownie.
  - **Obciążenie:** `getUser` wykonuje jedno zapytanie z `LEFT JOIN sessions`; zapis `last_used_at` najwyżej raz na 15 min na sesję.

## Odzyskiwanie hasła e-mailem (KON-1)
Wysyłka przez HTTP API Resend (`lib/mail.js`, `fetch`, bez SDK), tylko gdy ustawione są `RESEND_API_KEY` i `MAIL_FROM`. Bez nich link „Nie pamiętam hasła” i sekcja e-mail w profilu są ukryte, a `auth/forgot` i `PUT account/email` zwracają 503 z komunikatem. Zapisany wcześniej adres można wtedy tylko usunąć. Kod: `lib/account-email.js`, trasy w tabeli wyżej, strony `/odzyskaj-haslo`, `/nowe-haslo`, `/potwierdz-email`. Testy: `tests/db/email-recovery.test.js` (atrapa wysyłki) i `tests/e2e/email.test.mjs` (atrapa API Resend na localhost).

**Model zagrożeń i odpowiedzi:**
- **Enumeracja kont i adresów (atakujący 1).** `auth/forgot` ma jedną odpowiedź (status i treść), gdy konta nie ma, gdy nie ma adresu, gdy adres jest niepotwierdzony, gdy konto jest adminem i gdy przekroczono limit konta lub adresu. Czas jest wyrównany do ≥ 400 ms, a mail wychodzi po odpowiedzi (`after()`). 429 dają tylko limity niezależne od istnienia konta (IP, wpisany tekst). Adres nie ma indeksu unikalnego, bo błąd „adres zajęty” zdradzałby cudze konto. Kilka kont może mieć ten sam adres: każde dostaje osobny link z nazwą konta. Limit maili na adres przy dodawaniu adresu działa po cichu. Klucze limitów zawierają skrót adresu, nie adres.
- **Przejęcie konta przez link (1, 3).** Token to 32 losowe bajty. W bazie (`email_tokens`) jest tylko SHA-256. Token jest ważny 30 min, jednorazowy (zużycie warunkowym `UPDATE ... RETURNING`, więc dwa równoległe żądania nie przejdą oba) i działa tylko najnowszy danego rodzaju. Wyzwalacz w bazie usuwa tokeny resetu przy każdej zmianie `password_hash`: zmiana hasła, reset przez admina, hasło startowe admina, sam reset. Zmiana adresu usuwa wszystkie tokeny konta. Reset sprawdza, czy konto ma wciąż ten sam potwierdzony adres. Po resecie: nowa wersja sesji, wszystkie wiersze `sessions` unieważnione (lista urządzeń pusta), ciasteczko „znane urządzenie” nieważne, bez automatycznego logowania.
- **Wyciek tokenu.** Link niesie token we fragmencie (`#t=`), więc nie trafia do logów Vercel ani do `Referer`. Strona usuwa go z paska adresu i historii zaraz po wczytaniu. Potwierdzenie adresu wymaga kliknięcia przycisku, więc skaner linków w poczcie nie zużyje tokenu.
- **Host header injection.** Link powstaje z `APP_URL` (tylko https, albo http na localhost). Bez `APP_URL` używany jest nagłówek Host, ale tylko z listy dozwolonych: `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_BRANCH_URL`, `VERCEL_URL` i `APP_HOSTS`. Inny host albo błędny `APP_URL` = brak wysyłki (wpis w dzienniku błędów), odpowiedź bez zmian.
- **Przejęta sesja (2).** Dodanie lub zmiana adresu wymaga obecnego hasła i zgody. Inaczej napastnik podpiąłby swoją skrzynkę i resetem utrwalił przejęcie. Nowy adres zawsze wymaga potwierdzenia, a do resetu służy tylko potwierdzony.
- **Konta administratora** nie odzyskują hasła e-mailem (odpowiedź jak dla każdego innego konta). Przejęcie skrzynki admina nie daje panelu ani kopii. Admin odzyskuje dostęp przez `BOCIAN_INITIAL_PASSWORD` albo innego admina.
- **Prywatność adresu.** Adres widzi tylko właściciel (`GET account/email`). Nie ma go w wyszukiwarce, na profilu, w liście użytkowników admina ani w alertach. Jest w eksporcie (`profile.email`, `email_verified_at`, `email_consent_at`) i w kopii (`users`), a znika z kontem. `email_tokens` nie trafia do kopii ani eksportu. Zgoda: `email_consent_at`; usunięcie adresu kasuje adres, zgodę i tokeny. Błędy wysyłki trafiają do dziennika tylko jako kod HTTP, bez adresu i bez treści odpowiedzi dostawcy.
- **Treść maili** jest neutralna (bez słów o konopiach i lekach). Z urządzenia w trybie dyskretnym nazwa to „Notatnik”. Dostawca (Resend) widzi adres, temat i treść maila. Treść nie zawiera danych zdrowotnych, a temat i nazwa nadawcy są neutralne.
- **Zgodność wstecz.** Kolumna `users.email` istniała wcześniej, ale nic do niej nie pisało. Nowe kolumny i tabela są addytywne. Sesje i tokeny bez zmian.

## Alerty o błędach (PLA-2)
`lib/alerts.js`, wywoływane z `logError` po zapisie błędu. Kanały: `ALERT_WEBHOOK_URL` (tylko https, bez przekierowań; Discord dostaje `{content}`, inne, w tym Slack, `{text}`) i `ALERT_EMAIL` (wymaga wysyłki z KON-1). Bez obu nic się nie dzieje. Powody alertu: co najmniej `ALERT_THRESHOLD` (domyślnie 5) błędów serwera w 15 min albo pierwszy w dzienniku błąd o danym źródle, ścieżce i komunikacie (cyfry pomijane). Limity: 1 alert progowy na 15 min, 3 o nowym rodzaju na godzinę, 20 na dobę. Alert zawiera tylko źródło, ścieżkę (bez zapytania), liczby, czas i link do panelu. Nie zawiera treści błędu, bo komunikaty SQL potrafią powtarzać dane z żądania. Pomijane są błędy z przeglądarki (publiczny `client-error`, inaczej każdy mógłby wywoływać alerty) i błędy samych alertów (źródło „alert”, bez pętli). Alert próbny: panel admina, „Dziennik błędów”. Testy: `tests/db/alerts.test.js`.

## Blokada w przeglądarce (POM-25)
Ekran PIN zasłania treść (także przy ukryciu karty); chroni przed przypadkowym wglądem (wspólny komputer, odblokowany telefon), nie przed kimś z dostępem do narzędzi przeglądarki: skrót PIN-u leży w `localStorage`, a 4-8 cyfr da się złamać offline, więc realną barierą są opóźnienia i wylogowanie po 10 błędach, które działają tylko w interfejsie. WebAuthn to lokalne potwierdzenie obecności bez serwera (nie sprawdzamy podpisu). Zasłona w podglądzie przełącznika aplikacji (iOS) zależy od systemu i bywa niepełna. Wylogowanie po bezczynności jest po stronie klienta (wymaga otwartej karty lub kolejnego wejścia); serwerowe wygaszanie sesji to osobna sprawa (lista sesji). Sama strona `/login` nie odblokowuje karty (odblokowuje dopiero poprawne logowanie, `markFreshLogin`), a logowanie innej osoby na tym urządzeniu usuwa poprzedni PIN. Testy: `tests/applock.test.js`.

## Do decyzji właściciela
1. **`AUTH_SECRET` ≥ 32 znaki:** dziś minimum to 16. Wymuszenie w kodzie wyłączyłoby produkcję, jeśli obecny sekret jest krótszy. Zalecenie: sprawdzić w Vercel i w razie potrzeby wymienić; wymiana wyloguje wszystkich.
2. **Prefiks `__Host-` dla ciasteczka sesji:** chroni przed nadpisaniem ciasteczka z subdomeny. Zmiana nazwy wyloguje wszystkich jednorazowo. Ma sens po przejściu na własną domenę.
3. ~~**Unieważnianie pojedynczej sesji po wylogowaniu**~~: zrobione w POM-27 (#26).
4. **Szyfrowanie kopii:** ustawić `BACKUP_ENCRYPTION_KEY`. Bez niego kopie w Blob (wszystkie dane zdrowotne) są tylko skompresowane.
5. **Pobieranie kopii przez admina:** rozważyć ponowne podanie hasła przed `GET /api/backup`. Przejęta sesja admina daje dziś pełny zrzut bazy.
6. ~~**DT-7:** każdy zalogowany edytuje wspólne pola odmian.~~ Zamknięte (KAT-1): pola wspólne zmienia bezpośrednio tylko admin i twórca odmiany, dopóki nikt inny jej nie używa; pozostali składają propozycję (limit 20 oczekujących i 30 na godzinę na osobę), którą rozpatruje admin. Propozycje widzi tylko autor i admin. Usunięcie konta kasuje propozycje autora (kaskada), a przyjęte zmiany zostają w historii odmiany bez powiązania z kontem. Pozostaje: nowe opcje (producent, typ, terpen) dopisują się do wspólnych list już przy złożeniu propozycji, bez zatwierdzenia; zdjęcie odmiany ma własne reguły uprawnień (dodający, twórca, admin).
7. **Wyszukiwarka użytkowników:** każdy zalogowany może wylistować nazwy kont (po 10 na zapytanie, od 2 znaków). Rozważyć wyszukiwanie tylko po pełnej nazwie albo limit.
8. **Next 16:** usuwa ostrzeżenie o postcss (#24) i daje nowsze poprawki bezpieczeństwa. To osobne zadanie z testami.
9. **HSTS `includeSubDomains; preload`:** dopiero przy własnej domenie.
10. **`FileProvider` z `external-path "."`:** pochodzi z szablonu Capacitor i nie jest eksportowany. Można zawęzić do `cache-path`, jeśli nic poza drukiem go nie używa (sprawdzić przy następnym buildzie APK).
11. **E-mail (KON-1):** `MAIL_FROM` (nazwa i domena nadawcy) widać w skrzynce i na ekranie blokady, niezależnie od trybu dyskretnego: wybrać neutralną (np. „Notatnik”, domena bez słowa „konopie”). Do decyzji: blokada resetu e-mailem dla kont administratora (dziś zablokowany), kilka kont z tym samym adresem (dziś dozwolone, każde dostaje osobny link).

## Dla prac nad kolejką offline (pliki poza tym audytem)
- Wpisy w IndexedDB trzeba wiązać z id użytkownika i czyścić przy wylogowaniu: miejsce na to to `clearDeviceData()` w `app/components/deviceData.js`, wołane z `LogoutButton.js` i `ProfileForm.js` (te pliki zmienił audyt, przy scalaniu uwaga na konflikty). Inaczej na wspólnym telefonie zużycie lub objawy osoby A wyślą się na konto osoby B.
- `DELETE /api/symptoms`: `String(day)::date` bez walidacji. Błędna data daje 500 i wpis z treścią wejścia w `error_log`; potrzebna walidacja jak w PUT.
- Odtwarzanie kolejki musi wysyłać żądania z tej samej domeny (`fetch` ze strony lub Service Workera). Inaczej odrzuci je kontrola Origin w `middleware.js`.
- `safe()` dodaje teraz `Cache-Control: no-store` do odpowiedzi wszystkich tras (także `usage`, `purchase`, `symptoms`), jeśli trasa nie ustawi własnego; kolejka nie powinna opierać się na cache HTTP.
