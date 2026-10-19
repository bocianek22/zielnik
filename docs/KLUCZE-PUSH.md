# Klucze do powiadomień push: krok po kroku

Instrukcja dla właściciela. Bez tych kroków aplikacja działa, tylko przypomnienia push są wyłączone (profil pokazuje komunikat).
Zasada: **żadnego klucza nie wklejaj na czat, do issue ani do repozytorium**. Klucze trafiają tylko do Vercel (Environment Variables) albo GitHub (Secrets).

Są trzy niezależne części. Każda działa osobno:

| Część | Do czego | Gdzie ustawić | Ile czasu |
|---|---|---|---|
| A. `CRON_SECRET` | serwer w ogóle uruchamia przypomnienia, kopię i katalog | Vercel | 2 min |
| B. Klucze VAPID | push w przeglądarce i w zainstalowanej PWA | Vercel | 5 min |
| C. Firebase (FCM) | push w aplikacji APK na Androida | GitHub (APK) + Vercel (serwer) | 20 min |
| D. Co godzinę (po Vercel Pro) | przypomnienie o godzinie wybranej przez użytkownika, wieczorne objawy | Vercel + `vercel.json` | 5 min |

Kolejność: A, B, C. D dopiero po przejściu na Vercel Pro.

## Jak dodać zmienną w Vercel
Vercel, projekt `zielnik`, **Settings → Environment Variables → Add New**. Nazwa, wartość, środowisko **Production** (i Preview, jeśli chcesz testować na podglądach), zaznacz **Sensitive**, Save.
Zmienne działają dopiero w **nowym wdrożeniu**: Deployments, ostatnie produkcyjne, menu „…”, **Redeploy** (albo po prostu następne scalenie do `main`).

## A. `CRON_SECRET` (sekret zadań cyklicznych)
Vercel wysyła go sam w nagłówku przy każdym uruchomieniu crona; bez niego trasy `/api/cron/*` odpowiadają 401.
1. Wygeneruj losowy ciąg (co najmniej 16 znaków, najlepiej 64). Na komputerze: `openssl rand -hex 32`. Bez terminala: menedżer haseł, „wygeneruj hasło”, 40+ znaków, same litery i cyfry.
2. Dodaj w Vercel jako `CRON_SECRET`, Redeploy.
3. Jeśli już jest ustawiony (panel „Gotowość” pokazuje „ok”), nic nie zmieniaj.

## B. Klucze VAPID (push w przeglądarce i PWA)
1. Na swoim komputerze (potrzebny Node.js 18+), w dowolnym katalogu:
   ```
   npx web-push generate-vapid-keys
   ```
   albo w sklonowanym repozytorium: `node scripts/vapid-keys.js`. Dostaniesz dwa klucze: publiczny (Public Key) i prywatny (Private Key).
2. W Vercel dodaj trzy zmienne:
   - `VAPID_PUBLIC_KEY` = klucz publiczny,
   - `VAPID_PRIVATE_KEY` = klucz prywatny,
   - `VAPID_SUBJECT` = `mailto:` i Twój adres kontaktowy, np. `mailto:kontakt@twoja-domena.pl` (bez spacji; to kontakt dla operatorów push, nie jest pokazywany użytkownikom).
3. Redeploy.
4. Zapisz parę kluczy w menedżerze haseł. **Klucza prywatnego nie zmieniaj później**: nowa para unieważnia wszystkie subskrypcje, każdy musiałby włączyć powiadomienia od nowa.

Sprawdzenie: zaloguj się, Profil, „Przypomnienia”, „Włącz powiadomienia”, zgoda przeglądarki, „Wyślij testowe powiadomienie”. Powinno przyjść neutralne powiadomienie „Zielnik”.

Uwaga o domenie (piątek): subskrypcja push w przeglądarce jest przypisana do adresu strony. Po przejściu na własną domenę klucze zostają te same, ale osoby, które włączyły push na `…vercel.app`, muszą włączyć je ponownie już na nowej domenie. Dlatego klucze można dodać już teraz, a testerów poprosić o włączenie powiadomień dopiero po przenosinach.

## C. Firebase (push w aplikacji APK)
Konto Google, plan **Spark (0 zł)**, karta płatnicza nie jest potrzebna.

1. **Projekt**: [console.firebase.google.com](https://console.firebase.google.com/), „Utwórz projekt”, nazwa np. `zielnik`. Google Analytics możesz wyłączyć (nie jest potrzebny).
2. **Aplikacja Android**: w projekcie ikona Androida („Dodaj aplikację”), **nazwa pakietu dokładnie `pl.zielnik.app`**, pseudonim dowolny, SHA-1 pomiń. „Zarejestruj aplikację”.
3. **`google-services.json`**: pobierz plik (kolejne kroki kreatora z Gradle pomiń, są już w projekcie). Otwórz go w edytorze tekstu i skopiuj całą zawartość.
4. **Sekret w GitHub**: repozytorium `zielnik`, Settings → Secrets and variables → Actions → New repository secret. Nazwa `GOOGLE_SERVICES_JSON`, wartość = cała zawartość pliku. (Ten plik nie jest tajny w sensie haseł, ale nie commituj go; jest w `.gitignore`.)
5. **Nowy APK**: Actions → „Aplikacja Android” → Run workflow. Nowy build ma FCM; po instalacji w profilu pojawi się „Włącz powiadomienia”.
6. **Klucz serwera (konto usługi)**: w Firebase koło zębate → Ustawienia projektu → **Konta usługi** → „Generuj nowy klucz prywatny” → pobierze się plik JSON. To jest prawdziwy sekret: nie wysyłaj go nikomu.
7. **Zmienna w Vercel**: `FIREBASE_SERVICE_ACCOUNT` = cała zawartość tego pliku JSON (wklej tak, jak jest, z klamrami; można też w base64). Redeploy.
8. **API w Google Cloud**: zwykle włączone samo. Jeśli testowe powiadomienie w APK nie przychodzi, wejdź na [console.cloud.google.com](https://console.cloud.google.com/), wybierz ten sam projekt, „Interfejsy API i usługi”, wyszukaj **Firebase Cloud Messaging API** i kliknij „Włącz”. Domyślne konto `firebase-adminsdk-…` ma już potrzebną rolę.
9. Pobrany plik JSON klucza po wklejeniu do Vercel przenieś do menedżera haseł albo usuń z dysku.

Sprawdzenie: w APK Profil → „Włącz powiadomienia” → zgoda Androida → „Wyślij testowe powiadomienie”.

## D. Godzina wybrana przez użytkownika (po przejściu na Vercel Pro)
Na planie Hobby Vercel uruchamia crony najwyżej raz dziennie, więc przypomnienia idą raz rano (`0 7 * * *` UTC, ok. 8-9 w Polsce). Po przejściu na Pro:
1. Dodaj w Vercel `PUSH_CRON_HOURLY=1`.
2. W `vercel.json` zmiana harmonogramu przypomnień z `0 7 * * *` na `0 * * * *` (co godzinę). To zmiana w kodzie: napisz mi „Vercel Pro jest”, zrobię to w osobnym PR razem ze sprawdzeniem.
3. Wtedy działa godzina wybrana w profilu i wieczorne przypomnienie o objawach.

Kolejność ma znaczenie: najpierw cron co godzinę, potem zmienna (sama zmienna bez częstszego crona sprawi, że przypomnienia przyjdą tylko tym, którzy wybrali godzinę porannego uruchomienia).

## Jak sprawdzić, czy wszystko jest ustawione
Panel admina → zakładka **„Gotowość”**: pozycje `CRON_SECRET`, `VAPID_*` i `FIREBASE_SERVICE_ACCOUNT` mają status „ok”, „słabe” (np. tylko część zmiennych albo uszkodzony JSON) albo „brak”. Panel nie pokazuje wartości kluczy, tylko to, czy są.

## Najczęstsze problemy
- **„Powiadomienia push nie są jeszcze skonfigurowane”** po dodaniu zmiennych: nie było Redeploy.
- **„Ustawiona tylko część zmiennych VAPID”**: brakuje jednej z trzech albo jest literówka w nazwie.
- **iPhone**: push w przeglądarce działa tylko po dodaniu strony do ekranu początkowego (iOS 16.4+), z ikony, nie z Safari.
- **APK nie pokazuje „Włącz powiadomienia”**: zainstalowany build sprzed dodania `GOOGLE_SERVICES_JSON`; zbuduj i zainstaluj nowy.
- **Wyciekł klucz**: VAPID wygeneruj od nowa (wszyscy włączają push ponownie); konto usługi Firebase: w Google Cloud → IAM → Konta usługi → klucze → usuń stary, wygeneruj nowy, podmień `FIREBASE_SERVICE_ACCOUNT`.
