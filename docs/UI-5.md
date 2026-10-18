# UI 5: nowoczesny, przyjazny wygląd (decyzje właściciela, 17–18.10.2026)

Ustalenia z ankiety (pytania i odpowiedzi właściciela). Każda większa zmiana wyglądu: najpierw zrzuty przed/po i wybór wariantu przez właściciela, dopiero potem scalenie. Drobne poprawki po wyborze: scalanie samodzielne.

## Odpowiedzi
| Temat | Decyzja |
| --- | --- |
| Charakter | Nowoczesny, odważny (rozwinięcie obecnego kierunku) |
| Gęstość | „Tak, aby było jak najbardziej przyjaźnie i żeby ludzie z chęcią korzystali”: wygodnie, nie ciasno; długość ekranów skracamy zwijaniem i personalizacją, nie zmniejszaniem elementów |
| Problemy dziś | Za długie ekrany, niespójność, za mało „wow” |
| Kolorowe nagłówki ekranów | Złagodzić (jaśniejsze, pastelowe tło, ten sam pomysł) |
| Ekran „Dziś” | Domyślnie: powitanie + plan dnia; do wyboru gotowe układy (profile) i pełna personalizacja (kolejność, ukrywanie kart) |
| „Wow” | Animacje i przejścia, ilustracje i ikony, nagrody i motywacja, lepsze wykresy |
| Nawigacja dolna | Decyzja projektanta (Claude) |
| Kolor przewodni, czcionka | Claude proponuje 2–3 warianty na zrzutach |
| Motywacja | Serie wpisów objawów, odznaki za porządek, podsumowanie tygodnia, krótka animacja przy zapisie. Nigdy nagradzania zużycia |
| Animacje | Subtelne (150–250 ms), z `prefers-reduced-motion` |
| Kolejność prac | Dziś → Dziennik i wykresy → Odmiany i karta odmiany → logowanie i pierwsze uruchomienie |
| Tryb ciemny | Równie ważny jak jasny |
| Użytkownicy | Mieszanka: młodsi, starsi, osoby z silnym bólem lub zmęczeniem |
| Ton tekstów | „Formalny, ale jednocześnie przyjazny”: uprzejmy, spokojny, bez wykrzykników i żartów; zostaje forma „ty” (forma Pan/Pani wymaga płci) |
| Komputer | Równie ważny: panel boczny + układ dwukolumnowy |
| Akceptacja | Zrzuty przed/po, wybór wariantu przed wdrożeniem |
| Wpis objawów | Suwaki z buźką, która zmienia się przy przesuwaniu |
| Inspiracje | Apple Zdrowie / Fitness, Revolut / aplikacje bankowe |

## Wybór wariantu (18.10.2026, zrzuty porównawcze)
- Kolory: wariant A „Zdrowie” (jasny górny pasek w kolorze tła, miętowy nagłówek „Dziś”) z pływającym paskiem dolnym z wariantu B (zaokrąglony, z rozmyciem tła).
- Czcionka: Plus Jakarta Sans (zamiast Figtree; PDF raportu bez zmian).
- Pasek dolny: 5 miejsc bez zmian (Dziś, Odmiany, +, Dziennik, Więcej).
- Ton: uprzejmie i spokojnie, na „ty”.
- Tokeny: `--topbar`, `--on-topbar`, `--on-topbar-2`, `--topbar-mark` (górny pasek); `--bar` zostaje ciemną zielenią marki (logowanie na komputerze, ekran blokady); `--bn-gap` (odstęp pływającego paska).

- Etap 2 (zaakceptowany): panel boczny od 1100 px (`SideNav.js`, nav.css).
- Etap 3, układy „Dziś” wybrane przez właściciela: Pełny (domyślny), Objawy najpierw, Zapas najpierw, Minimalny; plus pełna personalizacja.

- Etap 3 (zaakceptowany z uwagą właściciela: „wszystkie ustawienia do zakładki ustawień”): ustawienia „Dziś” w profilu (`#ekran-dzis`), na ekranie tylko link.

## Zasady techniczne
- Bez nowych bibliotek animacji, wykresów i przeciągania; jedna rodzina czcionek; budżety wydajności z CI.
- Układ „Dziś” zapisany na koncie: kolumna addytywna w `ensureDb`, biała lista identyfikatorów kart po stronie serwera, eksport i kopia, test w `tests/db/`.
- Odznaki i podsumowanie tygodnia liczone z istniejących danych; „już pokazane” w localStorage.
- Buźki na suwakach: własne SVG, `aria-hidden`, kierunek zależny od objawu (ból/lęk: 0 dobrze; sen/nastrój: 10 dobrze); tylko przy wpisie, nie na wykresach.
- Teksty nagród i podsumowań bez słów zdradzających temat aplikacji (tryb dyskretny), nazwy odmian z `.dn`.
- Pastelowe nagłówki: kontrast w trybie ciemnym, 320 px, „Większy tekst”, axe bez poważnych błędów.

## Etapy
1. Fundamenty: kolory i czcionka (warianty A/B/C do wyboru), nagłówki pastelowe, wygląd paska dolnego.
2. Powłoka: górny pasek, nawigacja, panel boczny na komputerze.
3. Dziś: powitanie i plan dnia, profile układu, tryb „Dostosuj”.
4. Dziennik: suwaki z buźkami, animacja zapisu, serie, lepsze wykresy.
5. Motywacja: odznaki, podsumowanie tygodnia.
6. Odmiany i karta odmiany.
7. Logowanie, rejestracja, kreator pierwszego uruchomienia.
