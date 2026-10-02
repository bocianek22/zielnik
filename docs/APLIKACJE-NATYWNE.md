# Aplikacje natywne iOS i Android (MOB-16)

Rozpoznanie z 2026-10-02 (zasady sklepów, technologia, koszty) i decyzje właściciela.

## Decyzje właściciela (2026-10-02)
- Konta deweloperskie **prywatne na start** (testy na własnym telefonie); decyzja o firmie (JDG, D-U-N-S) przed publikacją w App Store.
- **Najpierw Android** (APK z GitHub Actions, instalacja ręczna); iOS równolegle w kodzie, build na symulator w CI.
- **Ceny aptek ukryte w wersji natywnej** (flaga po stronie serwera); wersja webowa bez zmian.
- **Bez własnej domeny na razie**: aplikacja wskazuje na produkcję `*.vercel.app`; universal links i e-mail na domenie później.

## Technologia: Capacitor z `server.url`
Powłoka natywna (Android/iOS) ładuje produkcyjną aplikację Next.js. Ciasteczko sesji jest first-party (ta sama domena), aktualizacje bez wydania w sklepie. Natywne dodatki, które odróżniają aplikację od „owiniętej strony” (Apple 4.2): push (FCM, na iOS przez FCM z kluczem APNs .p8), blokada biometryczna przy otwarciu, natywne udostępnianie (raport dla lekarza), ewentualnie aparat do skanowania opakowań.
Odrzucone: statyczny build (Next.js z SSR się nie eksportuje), Expo/React Native (przepisanie UI), TWA (wymaga domeny i `assetlinks.json`).

## Zasady sklepów (najważniejsze)
- **Apple 5.1.1(ix)**: aplikacje z dziedzin regulowanych (wprost: opieka zdrowotna i legalne użycie konopi) powinien zgłaszać podmiot prawny, nie osoba prywatna. Precedensy w App Store (Releaf, Strainprint) to firmy. Konto prywatne wystarcza do TestFlight wewnętrznego; publikacja realnie wymaga firmy.
- **Apple 1.4.3 / Google Play**: zakaz ułatwiania sprzedaży konopi (koszyk, zamawianie, linki „kup”). Dziennik pacjenta jest dopuszczalny; ceny i katalog ukrywamy w wersji natywnej, ocena 18+, geo-ograniczenie do Polski.
- **Apple 4.2** (minimalna funkcjonalność), **5.1.1(v)** (usuwanie konta w aplikacji - jest), **1.2** (zgłaszanie i blokowanie przy treściach użytkowników - jest), **1.4.1** (aplikacje medyczne: „to nie porada medyczna”).
- **Google Play**: konto prywatne założone po 13.11.2023 wymaga testu zamkniętego z min. 12 testerami przez 14 dni; deklaracje Health apps i Data safety (dane zdrowotne, URL usuwania konta); od 31.08.2026 docelowe API 36 (Android 16).
- Recenzenci potrzebują konta demo (zamknięta beta z zaproszeniami).

## Koszty i konta (właściciel)
| Pozycja | Koszt | Kiedy |
|---|---|---|
| Google Play Console | 25 USD jednorazowo | przed publikacją Androida |
| Apple Developer | 99 USD/rok | przed instalacją na iPhonie (TestFlight) |
| Firebase (FCM) | 0 | push w aplikacjach |
| Domena | ok. 50-80 zł/rok | universal links, e-mail, konto organizacji Apple |
| Firma (JDG) + D-U-N-S | wg przepisów | publikacja w App Store |

## Ryzyka
1. Odrzucenie w App Store przy koncie prywatnym (wysokie).
2. Odrzucenie 4.2 jako „owinięta strona” (średnie; mitygacja: push, biometria, udostępnianie).
3. Katalog z cenami uznany za ułatwianie sprzedaży (mitygacja: ukrycie w wersji natywnej).
4. RODO i dane zdrowotne (art. 9) przy osobie prywatnej jako administratorze danych.
5. Trwałość ciasteczka sesji w WKWebView po ubiciu aplikacji - do sprawdzenia na urządzeniu.

Źródła: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google Play: Inappropriate Content](https://support.google.com/googleplay/android-developer/answer/9878810), [Google Play: wymagania testów](https://support.google.com/googleplay/android-developer/answer/14151465), [Target API](https://developer.android.com/google/play/requirements/target-sdk).
