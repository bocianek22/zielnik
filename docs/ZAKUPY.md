# Usługi do podpięcia i zakupu (stan 9.10)

Ceny orientacyjne z października 2026 (źródła zewnętrzne, sprawdź na stronie dostawcy przed zakupem). Kolejność według stosunku ceny do korzyści: najpierw darmowe lub tanie rzeczy, które odblokowują najwięcej.

Legenda: **[W]** robi właściciel (konto, płatność, DNS), **[C]** potem robi Claude (kod, konfiguracja, dokumentacja).

## Ranking

| # | Co | Koszt | Co odblokowuje | Po zakupie |
|---|---|---|---|---|
| 1 | **Domena `.pl`** (np. OVH, home.pl, Cloudflare Registrar dla `.com`) | ok. 10-60 zł pierwszy rok, ok. 60-120 zł/rok później | Stały adres zamiast `*.vercel.app`, e-maile z własnej domeny (lepsza dostarczalność), klucze dostępu bez hasła (POM-26), logowanie Google (KON-3), większe zaufanie testerów | [W] kup, dodaj w Vercel (Settings → Domains) albo podaj mi nazwę, a dodam ją przez API. [C] `APP_URL`, nagłówki, linki w e-mailach, polityka prywatności |
| 2 | **Cloudflare (darmowy)**: DNS, Email Routing, Turnstile | 0 zł | Skrzynka `kontakt@domena` przekierowana na Gmail (adres do regulaminu i RODO), ochrona przed botami przy otwartej rejestracji, szybki DNS | [W] konto, przeniesienie DNS domeny, klucze Turnstile do env (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`). [C] otwarta rejestracja za flagą |
| 3 | **Resend (darmowy)**: 3000 e-maili/mies., 100 dziennie | 0 zł (Pro 20 USD/mies. dopiero przy setkach osób) | Reset hasła, potwierdzenie e-maila, powiadomienia o logowaniu, przypomnienia mailem (kod gotowy od 0.47.0) | [W] dodaj domenę w Resend, wpisz rekordy SPF/DKIM w DNS, ustaw `RESEND_API_KEY`, `MAIL_FROM` (np. `Zielnik <powiadomienia@domena>`) |
| 4 | **Monitoring dostępności** (UptimeRobot lub Better Stack, darmowe) | 0 zł | E-mail lub SMS, gdy strona albo baza nie działa (`/api/health`, gotowe) | [W] monitor HTTP co 5 min na `https://domena/api/health` |
| 5 | **Google Play Console** | 25 USD jednorazowo | Testy zamknięte w Google Play: testerzy instalują i aktualizują aplikację ze sklepu, bez ręcznego APK i zgody na „nieznane źródła”; później publikacja | [W] konto dewelopera (weryfikacja tożsamości trwa kilka dni, więc warto zacząć wcześnie). [C] podpisany pakiet AAB w CI, opis, polityka danych w Play |
| 6 | **Vercel Pro** | 20 USD/mies. (zawiera 20 USD kredytu na użycie) | Zgodność z warunkami (Hobby jest tylko do użytku niekomercyjnego), cron co godzinę (przypomnienia o wybranej godzinie, POM-05/15), dłuższe logi i czas funkcji, Speed Insights (rzeczywista szybkość u użytkowników, bez ciasteczek), limit wydatków | [W] przejście na Pro, ustaw limit wydatków (Spend Management). [C] `PUSH_CRON_HOURLY=1`, cron w `vercel.json`, region funkcji |
| 7 | **Neon Launch** | wg użycia, przy tej skali kilka USD/mies. | Przywracanie bazy do dowolnej chwili z 7 dni (PITR): bezpieczeństwo danych zdrowotnych ponad nocną kopię, brak limitów darmowego planu | [W] zmiana planu; sprawdź i podaj mi region projektu (jeśli UE, przeniosę funkcje do `fra1`) |
| 8 | **Prawnik** (regulamin, polityka prywatności, DPIA, ocena reklamy produktów leczniczych) | jednorazowo, zwykle kilka tys. zł | Warunek otwartej bety i 1.0 (PRA-1/2/3, KAT-4); wersje robocze są w `/regulamin` i `/prywatnosc` | [W] zlecenie. [C] wprowadzenie poprawek, nowa wersja zgody |
| 9 | **Skrzynka na domenie** (Zoho Mail darmowy lub Google Workspace ok. 7 USD/mies.) | 0-30 zł/mies. | Odpowiadanie z adresu `kontakt@domena` (punkt 2 tylko przekierowuje) | [W] opcjonalnie, gdy przekierowanie przestanie wystarczać |
| 10 | **Apple Developer Program** | 99 USD/rok | Aplikacja na iPhone'a przez TestFlight (dziś iPhone działa jako PWA). Wymaga też Maca lub płatnego CI do budowy | Dopiero gdy będzie wielu użytkowników iPhone'a |
| 11 | **Płatności** (Przelewy24, Stripe) | prowizja od transakcji | Premium (MON-1); wymaga regulaminu sprzedaży i prawnika | Decyzja po becie |

Świadomie pomijamy: zewnętrzną analitykę zachowań i narzędzia śledzenia błędów typu Sentry (wysyłałyby dane zdrowotne poza naszą infrastrukturę; mamy `error_log` i alerty), dodatkowe bazy i kolejki (obecna skala ich nie potrzebuje).

## Kolejność na początek tygodnia
1. Domena i Cloudflare (punkty 1-2), potem Resend z rekordami DNS (punkt 3).
2. Google Play Console od razu (weryfikacja trwa).
3. Vercel Pro z limitem wydatków, Neon Launch, podanie regionu Neon.
4. Zmienne w Vercel z `docs/BETA.md` (sekcja E), w tym `LEGAL_ADMIN_NAME` i `LEGAL_CONTACT_EMAIL` (adres z domeny).
5. Monitoring (punkt 4).

Po każdym kroku daj znać, co zostało ustawione (bez wartości kluczy), a ja dokończę konfigurację po stronie kodu.
