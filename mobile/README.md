# Zielnik: aplikacja natywna (Android, iOS)

Powłoka [Capacitor 8](https://capacitorjs.com/) ładująca produkcyjną aplikację webową (`server.url`). Interfejs, logika i dane są na serwerze (Next.js na Vercel), więc większość zmian trafia do aplikacji bez nowego wydania. Rozpoznanie zasad sklepów i decyzje właściciela: `docs/APLIKACJE-NATYWNE.md`.

Ten katalog ma własny `package.json`: zależności Capacitora nie trafiają do aplikacji Next.js, a Vercel go pomija (`.vercelignore`).

## Co jest w środku
| Element | Gdzie |
|---|---|
| Konfiguracja (adres serwera, user agent, ekran startowy, paski systemowe) | `capacitor.config.js` |
| Projekt Android (commitowany) | `android/` |
| Projekt iOS (commitowany, Swift Package Manager, bez CocoaPods) | `ios/` |
| Strona błędu i startowa (gdy serwer nieosiągalny) | `www/` |
| Ikona i ekran startowy (źródło) | `assets/logo.png` (z `public/icon-512.png`), `npm run assets` |
| Kod integracji po stronie strony | `app/components/NativeShell.js`, `app/components/native/bridge.js`, `app/profil/NativeLock.js` |
| Rozpoznanie aplikacji na serwerze | `lib/client.js` (`isNativeApp(headers)`) |
| CI | `.github/workflows/mobile-android.yml`, `.github/workflows/mobile-ios.yml` |

Wersje: `@capacitor/core|cli|android|ios` 8.5.2, `@capacitor/app` 8.1.2, `browser` 8.0.5, `haptics` 8.0.2, `preferences` 8.0.1, `push-notifications` 8.1.3, `splash-screen` 8.0.2, `status-bar` 8.0.4, `@aparajita/capacitor-biometric-auth` 10.0.0, `@capacitor/assets` 3.0.5. Android: `compileSdk`/`targetSdk` 36 (wymóg Google Play od 31.08.2026), `minSdk` 24, AGP 8.13, Gradle 8.14.3, JDK 21. iOS: minimum 15, Xcode z obsługą SPM.

`appId` = **`pl.zielnik.app`**. To tożsamość aplikacji w Google Play i App Store: **po pierwszej publikacji nie da się jej zmienić** (zmiana = nowa aplikacja, bez aktualizacji u dotychczasowych użytkowników). Jeśli ma być inna (np. domena firmy), zmień ją przed pierwszym wydaniem w `capacitor.config.js`, `android/app/build.gradle` (`namespace`, `applicationId`), pakiecie `MainActivity.java` i w projekcie Xcode.

## Jak to działa
- **Adres serwera**: zmienna `ZIELNIK_URL` przy `npm run sync*` (domyślnie `https://zielnik-seven.vercel.app`, tylko `https://`). Wartość trafia do projektów natywnych przy `cap sync`, więc zmiana wymaga nowego builda. W CI: pole „zielnik_url” przy ręcznym uruchomieniu albo zmienna repozytorium `ZIELNIK_URL` (Settings, Secrets and variables, Actions, Variables).
- **Rozpoznanie aplikacji**: powłoka dopisuje do user agenta `ZielnikApp/<wersja>` (wersja z `mobile/package.json`), a przy buildzie z Firebase także `ZielnikPush/fcm`. Serwer (`lib/client.js`) i strona (`bridge.js`) po tym poznają aplikację. To przełącznik wyglądu, nie zabezpieczenie.
- **Ukryte ceny**: w aplikacji nie ma cen za gram, średniej ceny, pól ceny w formularzach ani ceny w historii zmian i porównaniu (zasady App Store 1.4.3 / Google Play). Własne wydatki pacjenta (koszt zakupów w historii, raporcie i podsumowaniu miesiąca) zostają, bo to zapis w dzienniku, nie oferta. Wersja webowa bez zmian. Dane w API się nie zmieniły (ukrywa tylko interfejs).
- **Blokada aplikacji**: Mój profil, „Blokada aplikacji” (sekcja widoczna tylko w aplikacji, domyślnie wyłączona, zapis w pamięci telefonu przez Preferences). Przy otwarciu i po powrocie z tła po ponad 30 s pojawia się systemowe okno biometrii z możliwością użycia PIN-u/wzoru telefonu. Włączenie i wyłączenie wymagają potwierdzenia. Gdy telefon straci blokadę ekranu, funkcja wyłącza się sama (żeby nikt nie został zamknięty na zawsze).
- **Przycisk wstecz** (Android): cofa w historii strony, na pierwszej stronie chowa aplikację do tła.
- **Linki zewnętrzne**: otwierają się w przeglądarce systemowej (Custom Tabs / SFSafariViewController), nie w oknie aplikacji.
- **Paski systemowe**: jasne ikony na zielonym pasku (`--hemp-deep`); od Androida 15 strona rysuje się pod paskiem, a nagłówek dostaje odstęp `safe-area-inset-top` (klasa `native-app` w `app/globals.css`).
- **Ekran startowy**: zielone tło z logo; strona chowa go, gdy wie już, czy pokazać blokadę (najpóźniej po 3 s).
- **Sesja**: ciasteczko `zielnik_session` (30 dni) jest zapisywane na dysk przy każdym zejściu do tła (`MainActivity.java`), żeby przetrwało ubicie aplikacji.
- **Brak sieci**: lokalna strona `www/error.html` (kolory aplikacji, „Spróbuj ponownie”, sama ponawia po odzyskaniu sieci). Gdy sieć zniknie w trakcie pracy, strona pokazuje pasek „Brak połączenia” (`NativeShell.js`).
- **Haptyka** (`@capacitor/haptics`, wywoływana przez `window.Capacitor`, bez paczki w bundlu): lekka wibracja przy przełącznikach i chipach, sygnał sukcesu/błędu przy każdym zapisie (żądanie POST/PUT/PATCH/DELETE do `/api/` w ciągu 10 s od dotknięcia; push i powiadomienia pomijane). Ustawienie wibracji telefonu respektuje system. Kod: `app/components/native/behaviors.js`.
- **Przeciągnij, aby odświeżyć**: na górze strony, własna obsługa dotyku (`native/PullRefresh.js`): `router.refresh()` plus zdarzenie `zielnik:refresh`, na które listy z własnym stanem (odmiany, grupy, znajomi, recepty) reagują hookiem `useNativeRefresh`. Nie działa w polach, oknach i przewijanych kontenerach (`data-no-ptr` wyłącza ręcznie).
- **Przejścia między ekranami**: View Transitions API (Android WebView 111+), delikatne wygaszenie z przesunięciem; bez wsparcia albo przy „ogranicz ruch” brak animacji.
- **Klawiatura**: okno WebView zmniejsza Capacitor (`SystemBars` dodaje odstęp na klawiaturę, `windowSoftInputMode=adjustResize`), więc osobna wtyczka Keyboard nie jest potrzebna. Strona wykrywa klawiaturę po zmniejszeniu okna (klasa `kbd-open`): chowa dolny pasek i przyciski pływające, a aktywne pole przewija na środek.
- **Wersja**: profil pokazuje `versionName` (`App.getInfo()`); `build.gradle` bierze ją z `ZIELNIK_VERSION_NAME` (CI) albo z `mobile/package.json`. iOS: `MARKETING_VERSION` w projekcie Xcode jest osobno (1.0), do ustawienia przed TestFlight.
- **Ekran startowy i ikona**: tło `#1d3b27` w motywach (`windowSplashScreenBackground` dla Androida 12+, `windowBackground` po starcie: bez białego mignięcia). Ikona adaptacyjna (tło kolorem, przezroczysta warstwa liścia `drawable-nodpi/ic_launcher_fg.png`) i warstwa monochromatyczna dla Androida 13+. `npm run assets` nadpisuje `mipmap-anydpi-v26/ic_launcher*.xml` i gubi warstwę monochromatyczną: po jego użyciu przywróć je z gita.
- **Raport dla lekarza, „Udostępnij / Zapisz PDF”**: `window.print()` w Android WebView nic nie robi, więc strona woła własną wtyczkę `ZielnikPrint` (`PrintPlugin.java`, rejestrowana w `MainActivity`), która otwiera systemowe okno druku (`PrintManager` + `WebView.createPrintDocumentAdapter`) z „Zapisz jako PDF”, drukarkami i udostępnianiem. Nazwa pliku i zadania druku: „Raport dla lekarza od – do”, w trybie dyskretnym „Raport”. Starsza wersja APK bez wtyczki i iOS: dotychczasowe `window.print()`.
- **Skróty aplikacji** (przytrzymanie ikony, Android 7.1+, POM-12): „Zapisz” (panel „Zużyłem” ostatnio używanej odmiany, `/?zuzylem=1`), „Samopoczucie” (karta objawów w „Dziś”, `/#objawy`), „Raport” (`/raport`). Etykiety są statyczne, więc neutralne także przy trybie dyskretnym. `res/xml/shortcuts.xml` podaje ścieżkę w dodatku `pl.zielnik.app.PATH`; `MainActivity` sprawdza ją (tylko ścieżka w obrębie aplikacji, ta sama reguła co `SAFE_PATH` w `lib/shortcuts.js`) i otwiera pod adresem `server.url` po pierwszym wczytaniu strony (przy zimnym starcie nie przerywa wczytywania strony startowej). Zgodność plików pilnuje `tests/shortcuts.test.js`.
- **Widżet „Zapas i Zużyłem”** (Android, POM-13, projekt: `docs/WIDZET-ANDROID.md`): 2×1 na ekranie głównym, „Starczy na N dni” i przycisk „Zapisz” (`/?zuzylem=1`; dotknięcie reszty widżetu otwiera `/`). Strona przy każdym otwarciu panelu „Dziś” zapisuje przez wtyczkę `ZielnikWidget` (`WidgetPlugin.java`, `bridge.js`: `widgetSet`/`widgetClear`) do SharedPreferences `zielnik_widget` tylko datę końca zapasu (`until`), znacznik czasu i flagę blokady; widżet (`StockWidget.java`, `WidgetDays.java`) sam odlicza dni, bez sieci. Dane starsze niż 7 dni to „–”; przy włączonej blokadzie aplikacji widżet pokazuje „Sprawdź zapas” (bez liczby); bez nazw odmian i bez słów „konopie”/„Zielnik” w jego napisach. Wylogowanie, automatyczne wylogowanie, usunięcie konta, zmiana konta i ekran `/login` czyszczą dane widżetu. Testy: `tests/widget.test.js`, `tests/android-manifest.test.js`, `tests/shortcuts.test.js`, `WidgetDaysTest.java` (CI: `testDebugUnitTest`).
- Service worker PWA w aplikacji jest wyłączany (`RegisterSW.js`), bo powłoka ma własną stronę offline i push.

## Budowanie
Wymagania: Node 22, JDK 21, Android SDK (platforma 36). Najprościej przez GitHub Actions.

**GitHub Actions** (zalecane): workflow „Aplikacja Android” uruchamia się sam przy zmianach w `mobile/**` albo ręcznie (Actions, Aplikacja Android, Run workflow). Gotowy plik: w podsumowaniu przebiegu, sekcja Artifacts, `zielnik-debug-...` (zip z `app-debug.apk`).

**Lokalnie**:
```
cd mobile
npm ci
ZIELNIK_URL=https://zielnik-seven.vercel.app npm run sync:android
cd android && ./gradlew assembleDebug     # wynik: android/app/build/outputs/apk/debug/app-debug.apk
```
Albo `npx cap open android` i Run w Android Studio. Po zmianie ikony: podmień `assets/logo.png` (najlepiej 1024 px) i `npm run assets`.

`npm run sync*` przepisuje adres w `www/index.html` i `www/error.html`; przy innym adresie niż domyślny nie commituj tej zmiany.

## Instalacja APK na telefonie (Android)
1. Pobierz artefakt z GitHub Actions na telefon (albo na komputer i prześlij) i rozpakuj zip.
2. Stuknij `app-debug.apk`. Android zapyta o zgodę na instalowanie aplikacji z tego źródła (przeglądarki lub menedżera plików): Ustawienia, „Instaluj nieznane aplikacje”, włącz dla tej aplikacji, wróć i zainstaluj.
3. Play Protect może ostrzec o nieznanym deweloperze: „Więcej szczegółów”, „Zainstaluj mimo to”.
4. Kolejne wersje debug z CI są podpisane innym kluczem (każdy przebieg tworzy własny klucz debug), więc przed instalacją nowej trzeba odinstalować poprzednią (zniknie zalogowanie i ustawienie blokady). Z kluczem release (niżej) aktualizacje instalują się na poprzednią wersję.

## Co musi zrobić właściciel
1. **Adres serwera**: sprawdź, czy `https://zielnik-seven.vercel.app` to właściwa produkcja. Jeśli nie, ustaw zmienną repozytorium `ZIELNIK_URL`. Po zmianie domeny (własna domena) trzeba wydać nowy build.
2. **Keystore do podpisu** (raz, przed pierwszą instalacją „na stałe”):
   ```
   keytool -genkeypair -v -keystore zielnik-release.jks -alias zielnik -keyalg RSA -keysize 4096 -validity 10000
   base64 -w0 zielnik-release.jks > zielnik-release.jks.b64     # macOS: base64 -i zielnik-release.jks
   ```
   W GitHub (Settings, Secrets and variables, Actions, Secrets) dodaj: `ANDROID_KEYSTORE_BASE64` (zawartość `.b64`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`zielnik`), `ANDROID_KEY_PASSWORD`. Workflow zbuduje wtedy też podpisane `app-release.apk` i `app-release.aab` (do Google Play).
   **Plik `.jks` i hasła przechowuj bezpiecznie poza repozytorium** (menedżer haseł + kopia offline). Utrata klucza = brak możliwości aktualizacji aplikacji (w Play da się to obejść tylko przez Play App Signing i procedurę resetu klucza przesyłania). Nie commituj `.jks` (jest w `.gitignore`).
3. **Firebase (push)**: bez tego aplikacja działa, a powiadomienia są wyłączone (profil pokazuje komunikat). Aby włączyć:
   1. [console.firebase.google.com](https://console.firebase.google.com/) (konto Google, plan Spark za 0 zł), nowy projekt, „Dodaj aplikację” Android z nazwą pakietu `pl.zielnik.app`.
   2. Pobierz `google-services.json` i dodaj jego zawartość jako sekret `GOOGLE_SERVICES_JSON` (albo lokalnie zapisz w `mobile/android/app/google-services.json`; plik jest w `.gitignore`).
   3. Zbuduj aplikację ponownie: powłoka dopisze `ZielnikPush/fcm` i w profilu pojawi się „Włącz powiadomienia”.
   4. Wysyłka po stronie serwera: w Firebase, Ustawienia projektu, Konta usług, „Generuj nowy klucz prywatny” (plik JSON). Całą zawartość pliku ustaw na serwerze (Vercel, Environment Variables) jako `FIREBASE_SERVICE_ACCOUNT` (może być też zakodowana w base64) i wdróż ponownie. Konto usługi musi mieć rolę „Firebase Cloud Messaging API Admin” (domyślne konto `firebase-adminsdk-...` ją ma), a w Google Cloud włączone „Firebase Cloud Messaging API”. Bez zmiennej tokeny tylko się zapisują.
4. **iOS** (później): konto Apple Developer (99 USD/rok), patrz „iOS”.

## Push: kontrakt z serwerem
Powłoka (kod strony w `bridge.js`) rejestruje urządzenie w FCM i wysyła token do istniejącej trasy:
- `POST /api/push/subscription` z `{ "kind": "fcm", "token": "<token FCM>", "claim": true }` (zalogowany użytkownik; `claim: true` przy świadomym włączeniu w profilu, `false` przy codziennym odświeżeniu, które nie przejmuje urządzenia innego konta). Odpowiedź `{ ok, owned }`. Nie wymaga kluczy VAPID.
- `DELETE /api/push/subscription` z `{ "kind": "fcm", "token": "<token>" }` przy wyłączeniu.
- Serwer (`lib/push.js`, `parseFcmToken`) zapisuje wiersz `push_subscriptions(kind = 'fcm', endpoint = 'fcm:<token>', keys = {})`; walidacja: 20-4096 znaków `[A-Za-z0-9_:-]`. Test: `tests/db/push-fcm.test.js`.
- Stuknięcie w powiadomienie otwiera `data.url` (ścieżka zaczynająca się od `/`), więc wysyłka powinna dołączać `url` jak w Web Push (`buildPayload`).

**Wysyłka (serwer)**: `lib/fcm.js` podpisuje JWT (RS256, `jose`) kluczem z `FIREBASE_SERVICE_ACCOUNT`, wymienia go na token OAuth2 (zakres `firebase.messaging`, cache do wygaśnięcia) i wysyła `POST https://fcm.googleapis.com/v1/projects/<project_id>/messages:send`. `deliver()` (`lib/push.js`) używa jej dla wierszy `kind = 'fcm'`, więc dostają je cron przypomnień i powiadomienie testowe z profilu. Treść jest ta sama, neutralna co w Web Push („Masz 2 przypomnienia…”, bez nazw odmian, szczegóły tylko przy włączonym `showDetails`); `url` i `tag` idą w `data`. Token z odpowiedzią `UNREGISTERED`/404 jest usuwany, inne błędy liczą się jak w Web Push (po 30 usuwany). Bez zmiennej wysyłka FCM jest pomijana bez błędów. Testy: `tests/fcm.test.js`, `tests/db/push-fcm.test.js`.

## iOS
Projekt `ios/` jest wygenerowany (Swift Package Manager, bez CocoaPods) z `NSFaceIDUsageDescription` w `Info.plist`. Workflow „Aplikacja iOS (symulator)” (ręczny, macOS) buduje go bez podpisu na symulator; artefakt to `App.app` do uruchomienia w symulatorze Xcode.
Następne kroki: konto Apple Developer (99 USD/rok), w Xcode zespół i podpis, App ID `pl.zielnik.app`, potem Archive i TestFlight (wewnętrzny, do 100 testerów, bez recenzji). Push na iOS: klucz APNs (.p8) wgrany do Firebase, `GoogleService-Info.plist`, uprawnienie Push Notifications i przekazanie tokenu w `AppDelegate.swift` (dokumentacja `@capacitor/push-notifications`); do tego czasu iOS nie dopisuje `ZielnikPush/fcm` i push jest wyłączony. Publikacja w App Store realnie wymaga firmy (zasada 5.1.1(ix), `docs/APLIKACJE-NATYWNE.md`).

## Ograniczenia
- Bez własnej domeny nie ma universal links / app links (link z e-maila otworzy przeglądarkę, nie aplikację) ani konta organizacji w sklepach.
- Aplikacja wymaga internetu (dane są na serwerze); offline pokazuje stronę błędu.
- Formularze zdjęć otwierają systemowy wybór plików/galerii; bezpośrednie zrobienie zdjęcia aparatem z formularza wymagałoby wtyczki aparatu (do rozważenia).
- Blokada jest po stronie strony: podgląd w „ostatnich aplikacjach” zasłaniamy przy zejściu do tła, ale system może zrobić zrzut, zanim zasłona się narysuje.
- Nagłówek `ZielnikApp/` można podrobić w zwykłej przeglądarce (zobaczy się wtedy wersję bez cen); nie służy do zabezpieczeń.
- Przekierowania stron (np. na `/login`) Android obsługuje przez własne pobranie HTML (mechanizm Capacitora); do sprawdzenia na telefonie, czy adres w aplikacji zgadza się po przekierowaniu.

## Checklista testu na telefonie
- [ ] Instalacja APK, ikona i nazwa „Zielnik”, ekran startowy zielony z logo (jasny i ciemny motyw telefonu).
- [ ] Logowanie; po zamknięciu aplikacji z listy ostatnich (ubicie) i ponownym otwarciu nadal zalogowany. To samo po restarcie telefonu.
- [ ] Wylogowanie i ponowne logowanie; przekierowanie na `/login` dla niezalogowanego (adres i nawigacja działają).
- [ ] Profil: sekcja „Blokada aplikacji” widoczna (w przeglądarce na tym samym telefonie niewidoczna). Włączenie z odciskiem palca/PIN-em; zamknięcie i otwarcie aplikacji wymaga odblokowania; powrót z tła po ponad 30 s wymaga odblokowania, po kilku sekundach nie. Anulowanie okna: zostaje ekran „Zielnik jest zablokowany” z przyciskiem „Odblokuj”. Wyłączenie wymaga potwierdzenia.
- [ ] Przycisk wstecz: cofa między stronami (lista, karta odmiany, profil), na stronie głównej chowa aplikację.
- [ ] Link zewnętrzny (np. źródło w karcie charakterystyki, „Wesprzyj”) otwiera się w przeglądarce, powrót wraca do aplikacji.
- [ ] Ceny ukryte: lista odmian, karta odmiany (plakietka zł/g, „Średnia cena”, pole „Cena u mnie”), edycja odmiany (brak „Cena za gram”), porównanie, historia zmian, katalog. Zapis odmiany nie kasuje ceny wpisanej wcześniej w przeglądarce.
- [ ] Dodanie zdjęcia odmiany, testu i awatara (wybór z galerii; jeśli system proponuje aparat, zrobienie zdjęcia).
- [ ] Ciemny motyw (systemowy i przełącznik w aplikacji): pasek stanu czytelny, nagłówek nie wchodzi pod pasek, dolna nawigacja nad paskiem gestów.
- [ ] Tryb samolotowy: strona „Nie można połączyć się z Zielnikiem”, po włączeniu sieci „Spróbuj ponownie” wraca do aplikacji.
- [ ] (z Firebase) Profil, „Włącz powiadomienia”: zgoda systemowa, komunikat o zapisaniu telefonu; w eksporcie danych pojawia się urządzenie `fcm`.
- [ ] Eksport CSV (pobieranie plików w aplikacji).
- [ ] Raport dla lekarza, „Udostępnij / Zapisz PDF”: otwiera się systemowe okno druku; „Zapisz jako PDF” zapisuje cały raport (wszystkie strony, nazwy odmian widoczne), nazwa pliku „Raport dla lekarza RRRR-MM-DD – RRRR-MM-DD”; w trybie dyskretnym nazwa „Raport” (także w powiadomieniu o druku). Udostępnienie pliku z okna druku lub z Pobranych.
- [ ] Skróty: przytrzymanie ikony pokazuje „Zapisz”, „Samopoczucie”, „Raport” z ikonami. Z zamkniętej aplikacji i z aplikacji w tle: „Zapisz” otwiera stronę główną z otwartym panelem „Zużyłem” i aktywnym polem ilości (klawiatura może wymagać dotknięcia pola; bez strony błędu po drodze), „Samopoczucie” przewija do „Jak się dziś czujesz?”, „Raport” otwiera raport. Z włączoną blokadą, zimny start ze skrótu: dokładnie jedno okno biometrii i po odblokowaniu właściwy ekran (skrót wczytuje stronę drugi raz, po pierwszym wczytaniu strony startowej; ryzyko podwójnego okna albo utknięcia na „Zielnik jest zablokowany”). Bez odmiany z zapasem „Zapisz” otwiera po prostu stronę główną. Odświeżenie strony po skrócie nie otwiera panelu ponownie.
- [ ] Widżet (POM-13): długie przytrzymanie ekranu głównego, Widżety, „Zapas”: dodanie 2×1; wygląd w jasnym i ciemnym motywie, zmiana szerokości. Po otwarciu aplikacji i panelu „Dziś” (z zapisanym zużyciem i zapasem) widżet pokazuje „Starczy na N dni” zgodne z panelem; po „Zużyłem” liczba się zmienia (bez oczekiwania na 3 h); bez zużycia „–”. Dotknięcie „Zapisz”: otwiera panel „Zużyłem”; dotknięcie reszty: stronę główną. Z włączoną blokadą (profil): widżet pokazuje „Sprawdź zapas” bez liczby, a zimny start z „Zapisz” daje jedno okno biometrii i po odblokowaniu panel „Zużyłem”. Wyłączenie blokady przywraca liczbę. Wylogowanie, automatyczne wylogowanie (bezczynność, błędne PIN-y), „Wyloguj wszędzie”, usunięcie konta, logowanie na inne konto, ekran logowania: widżet pokazuje „–”. Zmiana daty w telefonie (o dni do przodu): liczba maleje; dane starsze niż 7 dni (cofnięcie/przesunięcie zegara, aplikacja nieotwierana): „–”. Restart telefonu: widżet nadal pokazuje dane. Ponowna instalacja: widżet pusty. Po zmianie hasła lub „wyloguj wszędzie” z innego urządzenia liczba zostaje do najbliższego otwarcia aplikacji (ryzyko szczątkowe).
- [ ] Haptyka: wibracja przy przełączniku/chipie, przy zapisie zużycia i wykupu (sukces), przy błędzie (np. złe hasło); brak wibracji, gdy telefon ma ją wyłączoną.
- [ ] Przeciągnięcie listy odmian w dół na samej górze: spinner, odświeżenie (zmień dane w przeglądarce i sprawdź). Przewijanie w górę/dół i formularz nie wywołują odświeżenia.
- [ ] Przejście między ekranami (dolny pasek, przycisk wstecz): subtelne, bez migotania paska; po wyłączeniu animacji w telefonie brak przejść.
- [ ] Ekran startowy zielony bez białego mignięcia (Android 12+ i starszy), ikona adaptacyjna w różnych kształtach, ikona tematyczna (Android 13+: Ustawienia, tapeta i styl, ikony tematyczne).
- [ ] Tryb samolotowy w trakcie pracy: pasek „Brak połączenia”; przy starcie bez sieci strona błędu z przyciskiem, po włączeniu sieci wraca sama.
- [ ] Klawiatura: przy otwartej klawiaturze dolny pasek znika, pole jest widoczne nad klawiaturą; po schowaniu klawiatury przyciskiem wstecz pasek wraca.
- [ ] Profil: na dole „Wersja aplikacji: 0.4.0”.
