# UI-2: dopracowanie interfejsu i wykresów

Projekt na październik 2026 (stan 0.51.0). Zasady bazowe: `docs/DESIGN.md`, dostępność: `docs/DOSTEPNOSC.md`. Ten dokument opisuje **co** i **dlaczego**. Realizują go dwa niezależne strumienie (A: wykresy, B: reszta interfejsu), opisane na końcu.

Zrzuty zrobione 9.10 na buildzie lokalnym z danymi z `seed.mjs` (konto `ania`). Szerokość 390 px w obu motywach dla `/`, `/historia`, `/dziennik`, `/obserwacje`, `/raport`, `/rankings`, `/profil`, `/recepty`, `/compare` i `/strains/1`, szerokość 1280 px dla `/`, `/historia`, `/dziennik` i `/strains/1`, do tego tryb dyskretny dla `/` i `/historia`. Zrzutów nie ma w repozytorium; odtworzysz je przez `scripts/dev/shots.mjs`.

## 1. Diagnoza

### Wykresy

| # | Ekran, element | Co jest nie tak |
|---|---|---|
| W1 | `/`, „Zużycie, 14 dni” (`TodayPanel.js`) | Słupki są szerokie (odstęp 6 z 20 jednostek), więc wychodzi gęsty blok bladej zieleni. Wykres nie ma osi Y ani podpisu maksimum, więc nie da się odczytać skali. Na 390 px przycisk „+” zasłania podpis „dziś”. Dzień zerowy to kreska 2 px, prawie niewidoczna. |
| W2 | `/historia`, słupki tygodniowe | Liczba stoi nad każdym słupkiem. Podpisy osi wychodzą poza dolną krawędź karty (widać na obu motywach). Słupki mają 34/47 szerokości, czyli to ciężkie bloki. Olej i pen pokazane są jako jedno długie zdanie z 8 liczbami pod wykresem, zamiast drugiej serii albo przełącznika. |
| W3 | `/dziennik`, „Ostatnie 30 dni” | Zużycie (słupki) leży na skali 0–10 objawów bez własnej osi, czyli to ukryty wykres o dwóch osiach. Do tego sugeruje związek „dawka–objaw”, czego `/obserwacje` świadomie unika. Linia „Jakość snu” znika pod „Nastrojem”, gdy wartości są równe. Znacznik stoi na każdym punkcie, są cztery wzory kreski i tekst 11 px w skalowanym `viewBox` (na telefonie ok. 10 px). |
| W4 | Paleta `--chart-1…7` | Walidator palety (skill dataviz) zgłasza błąd w obu motywach. Jasny: para lęk↔sen ma ΔE 0,3 przy protanopii i 8,5 przy normalnym widzeniu, a trzy kolory są prawie szare. Ciemny: wszystkie kolory leżą poza pasmem jasności (L ≈ 0,77), a para lęk↔sen ma ΔE 1,8 przy protanopii. Kolory odróżnia dziś tylko kreska i kształt punktu. |
| W5 | Szczegóły odmiany, „Zużycie tygodniowe” (`UsageChart.js`) | Najlepszy wykres w aplikacji (przesuwanie palcem, klawiatura, tabela dla czytnika), ale linia siatki jest przerywana, a słupki pełne i ciężkie. Ten wzorzec warto uogólnić. |
| W6 | Szczegóły odmiany, radar odczuć (`Effects.js`) | „Średnia wszystkich” ma kolor `--kind-sativa`, a znacznik rodzaju odmiany nie może służyć jako seria (DESIGN, zasada 4). Na radarze trudno porównać 5–7 osi, a podpisy są małe. |
| W7 | `/obserwacje` | Torowisko z kropką jest dobre i spokojne. Brakuje skali (0 i 10) przy pierwszym wierszu, a kropka ma 8 px na torze 2 px, więc w ciemnym motywie słabo ją widać. |
| W8 | `/raport` | W raporcie nie ma żadnej grafiki: tydzień po tygodniu to tylko lista i tabela. Lekarz nie widzi trendu jednym spojrzeniem. |

### Interfejs

| # | Ekran, element | Co jest nie tak |
|---|---|---|
| U1 | `/`, panel „Dziś” przy suszu i oleju | Dwa identyczne bloki zapasu z dwoma miernikami zajmują cały pierwszy ekran. Wykres i „Zużyłem” zaczynają się poniżej zgięcia, a przycisk „+” zasłania „Zużyłem”. |
| U2 | `/`, karta odmiany | Szara pigułka „Mam 20 ml, do wykupienia 10 ml” pod przyciskami: stan powinien stać obok liczby, nie pod akcjami. Linia meta zawija się w środku („· Hybryda · Olej” w nowym wierszu). |
| U3 | `/` na 1280 px | Rozwinięta karta odmiany pokazuje szare pudełko „Twoje pola” w karcie (karta w karcie, tabela DESIGN, pkt 2, poprawiona tylko na telefonie). Filtry to trzy rzędy kontrolek. |
| U4 | `/historia` | „Twój miesiąc”: siatka 2×2 z liczbami po 30 px, w której g i ml stoją jedna pod drugą bez podpisu. Brak porównania z poprzednim miesiącem. Zdanie „Najczęściej sięgałeś” ma formę męską (konto „Ania”). |
| U5 | `/dziennik` | Formularz zajmuje dwa ekrany, zanim pojawi się wykres. Pusta karta „Własne objawy · 0 z 3” ma 80 px wysokości i nie ma akcji. |
| U6 | `/profil` (ciemny) | Długi formularz w jednej karcie. Przycisk główny w jasnej mięcie jest najjaśniejszym elementem ekranu (znane z przeglądu DESIGN). |
| U7 | `/recepty` | Ostrzeżenie (5 linii) stoi w środku listy. Pierwsza karta „W aptece” powtarza dane z dalszej listy. |
| U8 | Liczby | Fraunces z `tabular-nums` w dużych liczbach („8,5”, „140”) daje luźne odstępy (`1` ma szerokość `0`). W osiach i tabelach jest dobrze. |
| U9 | Potwierdzenia | Zapis „Zużyłem” i wpis objawów potwierdza tylko tekst. Brak spójnego, krótkiego potwierdzenia (toast z „Cofnij” jest tylko w panelu „Dziś”). |
| U10 | Do sprawdzenia, nie poprawiać na ślepo | Na `/strains/1` zdjęcie się nie wczytało (tekst zastępczy). Prawdopodobnie to kwestia lokalnej podmiany bazy (`neon-shim`), sprawdzić log `shots.mjs`. Pole daty „10/09/2026” to język headless Chromium (en-US), a nie błąd aplikacji. |

Tryb dyskretny (sprawdzony zrzutem): nazwy odmian (`.dn`) są rozmyte, marka zmienia się na „Notatnik”. Liczby i wykresy zostają widoczne, bo nie zawierają nazw. **Zasada dla nowych wykresów:** każda nazwa odmiany w podpisie, legendzie, podpowiedzi i tabeli dla czytnika ma klasę `.dn`. Wykresy nie pokazują zdjęć, liścia ani słów „konopie”/„THC” w tytułach (tytuły mówią „Zużycie”, „Zapas”).

## 2. Moduł wykresów `app/components/charts/`

Bez nowych zależności: inline SVG, renderowany na serwerze, z małą „wyspą” klienta tylko do podpowiedzi.

### Pliki

| Plik | Rola | Klient? |
|---|---|---|
| `scale.js` | Czyste funkcje: `linear(domain, range)`, `niceTicks(max, n)` (0 / 0,5 / 1 / 2 / 5 × 10ⁿ), `band(n, width, {pad})`, `barPath(x, w, h, base, r=4)` (przeniesiony z `TodayPanel.js`), `smooth(values, window, minPoints)`. Bez Reacta, testowane w `tests/charts.test.js`. | nie |
| `fmt.js` | `num(x, max=2)` przez `toLocaleString('pl-PL')`, `ddmm(iso)` i `longDay(iso)` na łańcuchach ISO (bez `new Date()` w renderze, ten sam wynik na serwerze i w telefonie), `plural()`. | nie |
| `Frame.js` | Kontener `<figure>`: tytuł (`h3`), odczyt wybranej wartości (`aria-live="polite"`), slot na SVG, podpis osi X jako HTML (nie SVG, żeby tekst miał prawdziwe 12 px), tabela dla czytnika w `.sr-only`. | nie |
| `Bars.js` | Słupki pionowe (dni, tygodnie): grubość ≤ 24 px i ≤ 60% szerokości przedziału, zaokrąglenie 4 px tylko u góry, oś bazowa 1 px, jedna linia siatki na „ładnej” wartości z podpisem, zero jako znacznik 2 px w `--chart-zero`. Wybrany słupek ma pełny kolor, a pozostałe nie bledną (bladość zostaje tylko podczas przesuwania). | nie |
| `Line.js` | Linia 2 px (zaokrąglone łączenia), opcjonalne pasmo zakresu (`--chart-band`), punkt końcowy 8 px z obwódką 2 px w kolorze powierzchni, przerwy w danych bez łączenia. | nie |
| `Calendar.js` | Siatka dni (heatmapa): kolumny tygodni, komórki 4 stanów (sekcja 3). | nie |
| `HBars.js` | Poziome paski z wartością na końcu (pora przyjęcia, porównanie okresów, odczucia). | nie |
| `Scrub.js` | Wyspa klienta (`'use client'`), owija SVG. Pointer: najbliższy przedział (jak w `UsageChart.pick`), `touch-action: pan-y`. Klawiatura: `tabIndex=0` i strzałki ←/→, Home/End, Escape. Ustawia `data-sel` i treść odczytu. Pionowa linia celownika 1 px tylko dla wykresów liniowych. Nie ma pływającego dymka: odczyt stoi w nagłówku wykresu, więc palec go nie zasłania i nic nie wychodzi poza ekran. | tak |
| `Empty.js` | Stany: **brak danych** (jedno zdanie, bez pustej siatki; test `kreator.test.mjs` już tego pilnuje dla `sym-chart`) i **mało danych** (wykres rysowany, ale nad nim notka „Za mało wpisów, żeby pokazać trend (min. N)”, bez wygładzenia i pasma). | nie |

Zasady wspólne (z dataviz, w kodzie modułu, nie w każdym ekranie):
- Jedna oś Y na wykres. Dwie wielkości (zużycie i objawy) to dwa panele, nigdy wspólna skala.
- Liczba tylko przy wybranym, maksymalnym albo ostatnim punkcie, nie przy każdym. Resztę pokazuje odczyt i tabela.
- Tekst zawsze w `--text-2` / `--text-3`, nigdy w kolorze serii. Tożsamość serii pokazuje kreska albo kwadrat obok tekstu.
- Siatka i osie to linie ciągłe 1 px (`--chart-grid`, `--chart-axis`), bez kresek przerywanych (do poprawy w `.uchart-grid`).
- Podpowiedź tylko uzupełnia: każda wartość jest też w tabeli `.sr-only` (wzór: `UsageChart.js`).
- Rozmiar: SVG w `viewBox` z `width: 100%`, wysokość stała w CSS **razem z pasem osi** (zero CLS, bez przewijania w karcie). Podpisy osi są w HTML, żeby skalowanie `viewBox` nie zmniejszało tekstu.
- `forced-colors: active`: serie dostają `stroke: CanvasText`, a pasma `Canvas` z kreskowaniem 45° (jedyny przypadek tekstury).

### Tokeny (dodaje tylko strumień A w etapie A1)

Wszystkie w trzech blokach `globals.css` (jasny, `[data-theme=dark]`, `prefers-color-scheme`). Pilnuje tego `tests/theme.test.js`.

| Token | Jasny | Ciemny | Użycie |
|---|---|---|---|
| `--chart-data` | `#2f7d4a` | `#86c597` | jedna seria danych (zużycie, zapas); równa dzisiejszemu `--chart-4` |
| `--chart-data-soft` | `color-mix(in srgb, var(--chart-data) 38%, var(--surface))` | to samo | słupki niewybrane podczas przesuwania |
| `--chart-ref` | `#8a948c` | `#76817a` | seria porównawcza (poprzedni okres, średnia innych) |
| `--chart-band` | `color-mix(in srgb, var(--chart-data) 14%, transparent)` | to samo, 22% | pasmo zakresu lub niepewności |
| `--chart-grid` / `--chart-axis` | `var(--sep)` / `var(--sep-strong)` | to samo | siatka i oś |
| `--chart-zero` | `var(--sep-strong)` | to samo | dzień z zerem, „bez zużycia” |
| `--seq-1…4` | `#8cc29b #5ea173 #3b8155 #1f5a35` | `#2a5a3a #3f8457 #66b07e #a2d9b1` | kalendarz, rosnąca ilość (jeden odcień zieleni) |
| `--chart-1…7` | `#2a72cc #d65f2c #14946b #b27c00 #cf5f8c #2e7d1f #5546b0` | `#3987e5 #d95926 #199e70 #c98500 #d55181 #008300 #9085e9` | kategorie: tylko gdy seria **jest** tematem (nakładka objawów na komputerze, własne objawy) |

Wynik walidatora (`validate_palette.js`, powierzchnia `#ffffff` / `#171d19`):

| Zestaw | Tryb | Wynik | Najgorsza para |
|---|---|---|---|
| obecne `--chart-1…7` | jasny | **NIE PRZECHODZI** (chroma, CVD, normalne widzenie) | lęk↔sen: ΔE 0,3 (protan), 8,5 (normalne) |
| obecne `--chart-1…7` | ciemny | **NIE PRZECHODZI** (pasmo L, chroma, CVD, normalne) | lęk↔sen: ΔE 1,8 (protan), 7,8 (normalne) |
| nowe `--chart-1…7` | jasny | przechodzi (sąsiednie), kontrast ≥ 3:1 dla wszystkich | ΔE 8,4 (protan), 17,5 (normalne) |
| nowe `--chart-1…7` | ciemny | przechodzi (sąsiednie) | ΔE 8,4 (protan), 19,3 (normalne) |
| nowe `--chart-1…3` | oba, wszystkie pary | przechodzi | ΔE 9,2 / 9,4 (CVD), 20,4 / 20,9 (normalne) |
| `--seq-1…4` | oba, porządkowa | przechodzi (stały odcień, rosnąca jasność, skrajny ≥ 2:1) | jasny 2,04:1, ciemny 2,14:1 |
| `--chart-data`, `--chart-ref` | oba, kontrast z powierzchnią | ≥ 3:1 (`#5d685f` w ciemnym miał 2,94:1, dlatego `#76817a`) | |
| `--chart-grid`, `--chart-axis`, `--chart-zero` (`--sep`, `--sep-strong`) | oba | poniżej 3:1 (1,3–1,7:1), celowo: to tło i oś, nie dane | żaden stan danych nie może opierać się tylko na nich |

Wniosek: przy liniach, które się krzyżują (każda para jest „sąsiednia”), paleta jest bezpieczna dla **maksymalnie 3 serii** (sloty 1–4 przy wszystkich parach: ΔE 9,7 przy normalnym widzeniu, twardy błąd). Dlatego objawy dostają małe wykresy, po jednym na objaw (sekcja 3, punkt 3), a żaden wykres nie pokazuje więcej niż 3 serii w kolorach.

Migracja obecnych odbiorców (bez cichych zmian koloru):

| Miejsce | Dziś | Po A1 |
|---|---|---|
| `home.css` `.ubar` | `--chart-4` | `--chart-data` |
| `detail.css` `.uchart-bar` | `--chart-4` | `--chart-data` |
| `detail.css` `.meter-fill` (THC) / `.meter-cbd` | `--chart-2` / `--chart-3` | `--chart-data` / `--chart-ref` (miernik to wielkość, nie kategoria) |
| `history.css` `.bars .bar` | `--accent` | `--chart-data` |
| `lib/symptoms.js` ból, sen, lęk, nastrój, własne 1–3 | `--chart-1…7` | małe wykresy rysują wszystko w `--chart-data`; `color`, `dash` i `marker` zostają tylko dla legendy formularza, do usunięcia w A3 |
| `Effects.js` średnia / Ty | `--kind-sativa` / `--accent` | `--chart-ref` / `--chart-data` |

### Ruch

- Wejście: słupki rosną od osi (`transform: scaleY` z `transform-origin` u podstawy), a linia rysuje się przez `stroke-dashoffset`. Czas `--dur-2` × 2 (400 ms) z krzywą `--ease`, opóźnienie 12 ms na słupek, łącznie najwyżej 600 ms. Tylko `transform`/`opacity`/`stroke-dashoffset`, więc CLS zostaje 0.
- Animacja tylko przy pierwszym wyświetleniu (klasa `.chart-in` dodana w CSS `@keyframes`, bez JS). Przy zmianie zakresu albo jednostki: przejście `--dur-1`.
- `prefers-reduced-motion: reduce` jest już globalnie wyłączone w `globals.css`. Moduł nie może tego obchodzić (żadnych animacji w JS).

## 3. Wizualizacje: co tak, co nie

Priorytet: P1 = w tym cyklu, P2 = jeśli zostanie czas. Wartość opisana z perspektywy pacjenta. **Bez porad, bez ocen „lepiej/gorzej” kolorem, bez sugestii dawek.** Różnice podajemy neutralnie (liczba ze znakiem, kolor tekstu `--text`). Zielony i czerwony stan nie oznaczają „dobrze/źle”, a strzałek nie używamy.

1. **P1, panel „Dziś”: zużycie 14 dni (odświeżenie W1).** `Bars` + `Scrub`. Słupki 60% przedziału, linia siatki z podpisem „ładnej” wartości (np. „0,5 g”) po prawej, bez osi Y. Pod wykresem cienka pozioma linia średniej z 14 dni w `--chart-ref` z podpisem „średnio 0,32 g”. Podpisy osi: pierwszy dzień, poniedziałki i „dziś”. Prawy margines karty zostawia miejsce na „+” (patrz U1). Wartość: szybki rzut oka „czy dziś jak zwykle”.
2. **P1, prognoza zapasu: linia spadku z pasmem (zastępuje miernik 0–30 dni).** Oś X: dziś → +30 dni (albo do daty końca, jeśli wcześniej). Linia od dzisiejszego zapasu do zera przy średnim tempie, pasmo między tempem najwolniejszego i najszybszego tygodnia z ostatnich 4 tygodni. Na osi znacznik daty końca („ok. 4 listopada”) i, jeśli jest ważna recepta z resztą do wykupienia, pionowa kreska „recepta ważna do 17.10” w `--chart-axis` (bez ostrzegawczego koloru). Kolor `--warn` tylko w istniejącej sytuacji (< 7 dni albo poniżej progu), i to tylko w tekście nad wykresem. Dane: serwer liczy dwa dodatkowe tempa (`minRate`, `maxRate`), a nie przesyła 28 wierszy. **Nowa funkcja w `lib/strains.js` (obok danych panelu „Dziś”), bez zmiany `daysLeft` z `lib/widget.js` (używa go widżet Androida).** Test w `tests/db/today.test.js`. Przy mniej niż 14 dniach z wpisami pasma nie ma, zostaje sama linia i notka. Wysokość 96 px. Wartość: „kiedy muszę iść do apteki” z uczciwą niepewnością.
3. **P1, dziennik: objawy jako małe wykresy (zastępuje W3).** Na telefonie cztery panele po 72 px (plus własne objawy), każdy z jedną linią w `--chart-data` i pasmem zakresu 7 dni. Wygładzenie to średnia z 7 dni liczona tylko wtedy, gdy w oknie są co najmniej 4 wpisy, i bez przechodzenia przez przerwy. Surowe wpisy to małe kropki 4 px w `--chart-ref`. Etykieta panelu po lewej („Ból · 0 = brak, 10 = najgorszy”), ostatnia wartość po prawej. Wspólna oś X i wspólny `Scrub` dla wszystkich paneli (jeden odczyt: „8 października: ból 3, sen 8, lęk 2, nastrój 8”). Zużycie to osobny panel słupków na dole, z własną skalą i podpisem „g”. Nie ma nakładki, która sugerowałaby związek. Na 1280 px przełącznik „Osobno / Razem”: „Razem” to widok z wyróżnieniem, w którym jeden wybrany objaw jest w `--chart-data`, a pozostałe w `--chart-ref`, z podpisami na końcach linii. Nie ma nakładki 4+ kolorów (patrz wynik walidatora). Wzory kreski (`dash`) i kształty punktów z `lib/symptoms.js` przestają być potrzebne. Pasmo opisane jako „zakres z 7 dni”, a nie „przedział ufności”. Wartość: trend widać bez chaosu, sen nie znika pod nastrojem.
4. **P1, „Mój miesiąc” (POM-42), porównanie okresów w `/historia`.** Wybór okresu przez `.seg`: „Miesiąc / Kwartał”. Paski poziome (`HBars`) parami: bieżący okres w `--chart-data`, poprzedni w `--chart-ref`. Wiersze: zużycie (g, ml osobno), dni z użyciem, wykup, średnie objawów (z podpisem kierunku skali, jak w raporcie). Różnica jako tekst neutralny: „+0,4 g (+12%)”. Wartość: przygotowanie do wizyty kontrolnej. Dane: rozszerzenie `monthlyRecap` o poprzedni okres, test w `tests/db/recap.test.js`.
5. **P1, `/historia`: słupki tygodniowe (W2).** `Bars` z przełącznikiem „Susz (g) / Olej i pen (ml)” jak w panelu „Dziś” (zamiast zdania z 8 liczbami). Wartość tylko przy najwyższym tygodniu, oś w karcie.
6. **P2, kalendarz zużycia (heatmapa).** Telefon: kwartał (13 kolumn × 7 wierszy, komórka ok. 20 px) z przełącznikiem „Kwartał / Rok”, gdzie rok to 4 kwartały jeden pod drugim. Na 1280 px rok w jednym rzędzie (53 kolumny × 14 px). Cztery stany komórki muszą się różnić nie tylko kolorem: **nie zapisano** (pusta komórka z ramką 1 px `--chart-axis`; niski kontrast jest tu celowy, bo to brak danych), **„dzień bez zużycia”** (POM-38, `no_use_days`: kreska pozioma 8×2 px w `--chart-ref`, ≥ 3:1, rozróżnienie kształtem), **zużycie** (`--seq-1…4`, progi kwartylowe z własnych danych, legenda „mniej → więcej”), **dziś** (obwódka `--text`). Jednostki się nie sumują, więc przełącznik g/ml. Dotyk przez `Scrub` w dwóch wymiarach (najbliższa komórka), klawiatura: strzałki we wszystkich kierunkach. Tabela dla czytnika: miesiące i dni z wartościami. Wartość: regularność widać jednym spojrzeniem i łatwo pokazać ją lekarzowi.
7. **P2, pora przyjęcia.** `HBars`, 4 wiersze („rano”, „w ciągu dnia”, „wieczorem”, „w nocy”, `lib/usage-meta.js`), jeden kolor, liczba wpisów i procent na końcu. W szczegółach odmiany (ostatnie 90 dni) i w raporcie (dane już są w `lib/report.js`, zapytanie `kind='period'`). Bez wykresu kołowego. Wartość: opis nawyku dla lekarza.
8. **P2, odczucia odmiany (W6).** Radar zastąpiony parami pasków na wspólnej skali 0–10: „Ty” w `--chart-data`, „średnia (N ocen)” jako znacznik pionowy 2 px w `--chart-ref` na tym samym torze. Wartość: dokładniejsze porównanie i brak koloru rodzaju odmiany w roli serii.
9. **P2, raport dla lekarza (W8).** Na górze raportu jedna mała seria tygodniowa zużycia (`Bars`, 120 px) i małe wykresy objawów (jak w punkcie 3, bez `Scrub`). Druk: `@media print` dostaje czarno-szare serie (`--chart-data` → `#333`) i tabelę obok wykresu. Wartość: lekarz widzi trend w 5 sekund.
10. **P2, oś czasu recept.** W `/recepty`: poziome odcinki od wystawienia do ważności na wspólnej osi dat, z wypełnieniem równym części wykupionej i kreską „dziś”. Pokazujemy tylko recepty ważne albo wygasłe w ostatnich 90 dniach. Wartość: widać, które recepty się nakładają, a która przepada.

Odrzucone:
- **Profil terpenów (radar, paski).** Terpeny to tylko nazwy (`strains.terpenes JSONB` z samymi napisami, bez ilości), więc wykres rysowałby nieistniejące dane. Zostają chipy.
- **Wykres korelacji dawka–objaw (PAC-7).** Sugerowałby skuteczność, a `/obserwacje` celowo tego unika.
- **Wykresy kołowe i pierścieniowe, wskaźniki „postępu” i serie dni z rzędu.** To elementy grywalizacji przy leku.
- **Średnie ceny w czasie (KAT-13).** Za mało danych przed betą, wrócić po 1.0.

### Prototypy (opis do odwzorowania)

Prognoza zapasu, 390 px (karta z wewnętrznym marginesem 16 px, czyli 326 px wykresu):
```svg
<svg viewBox="0 0 326 96" role="img" aria-label="Prognoza zapasu suszu: 8,5 g, przy obecnym tempie do ok. 4 listopada (zakres 30 października – 9 listopada)">
  <line x1="0" x2="326" y1="88" y2="88" stroke="var(--chart-axis)"/>                       <!-- oś: zero zapasu -->
  <path d="M0,8 L210,88 L292,88 Z" fill="var(--chart-band)"/>                               <!-- pasmo: najszybszy..najwolniejszy tydzień z 4 -->
  <line x1="0" y1="8" x2="282" y2="88" stroke="var(--chart-data)" stroke-width="2" stroke-linecap="round"/>  <!-- średnie tempo -->
  <circle cx="0" cy="8" r="4" fill="var(--chart-data)" stroke="var(--surface)" stroke-width="2"/>              <!-- dziś -->
  <line x1="87" x2="87" y1="8" y2="88" stroke="var(--chart-axis)"/>                         <!-- recepta ważna do 17.10 -->
</svg>
<!-- pod spodem, HTML 12 px --text-2: "dziś" | "17.10 recepta" | "ok. 4.11" (pod końcem linii, --text) -->
```

Objawy jako małe wykresy, jeden panel (72 px):
```svg
<svg viewBox="0 0 326 72" role="img" aria-label="Ból, 30 dni: ostatnio 3, zakres z 7 dni 3–5">
  <line x1="0" x2="326" y1="70" y2="70" stroke="var(--chart-axis)"/>                   <!-- 0 -->
  <line x1="0" x2="326" y1="36" y2="36" stroke="var(--chart-grid)"/>                   <!-- 5 -->
  <path d="M190,20 C230,24 270,30 326,46 L326,58 C270,44 230,36 190,30 Z" fill="var(--chart-band)"/>
  <path d="M190,25 C230,30 270,38 326,52" fill="none" stroke="var(--chart-data)" stroke-width="2"/>
  <g fill="var(--chart-ref)"><circle cx="190" cy="22" r="2"/><circle cx="201" cy="22" r="2"/><!-- ... surowe wpisy --></g>
  <circle cx="326" cy="52" r="4" fill="var(--chart-data)" stroke="var(--surface)" stroke-width="2"/>
</svg>
<!-- nad panelem: "Ból" (14 px, 600) · "0 = brak, 10 = najgorszy" (12 px, --text-3); po prawej "3" (Fraunces 20) -->
```

## 4. Dopracowanie interfejsu (strumień B)

Wszystko w ramach DESIGN.md: spokojnie, jeden akcent, listy zamiast kart. Dwie świadome poprawki zasad są opisane na końcu sekcji.

- **„Dziś” (U1).** Przy dwóch jednostkach zapas pokazujemy jako jeden blok z dwoma liczbami obok siebie („8,5 g · 26 dni” | „20 ml · 140 dni”), a nie dwa pełne bloki. Miernik 0–30 zastępuje prognoza z punktu 2 sekcji 3: A zmienia tylko `charts/StockGauge.js`, B przesuwa najwyżej linię `<StockGauge … />`. „Ostatnio używana” i „Zużyłem” są wyżej, zaraz pod zapasem. Na `/` karta dostaje `padding-bottom` równy wysokości „+” plus 16 px, żeby przycisk niczego nie zasłaniał.
- **Lista odmian (U2, U3).** Stan („Mam 20 ml”) w prawej kolumnie pod oceną, `tabular-nums`. Linia meta nie zawija się w środku: jedna linia z wielokropkiem, a pełna treść w szczegółach. Na 1280 px rozwinięta karta bez szarego pudełka (ten sam układ co na telefonie, pola w siatce 2 kolumn). Filtry na desktopie w jednym rzędzie, rzadkie (eksport, import) w menu „Więcej” listy.
- **Szczegóły odmiany.** Kolejność: nagłówek, liczby (ocena końcowa, średnia, moja), „Mój dziennik” (statystyki i wykres), skład, opis, odczucia, wpisy innych. Statystyki jako `.stat-strip` w 2 kolumnach z jednakową wysokością. Zdjęcie: stały `aspect-ratio: 4/3` ze szkieletem (zero CLS) i stan „brak zdjęcia” jako `.empty` 120 px zamiast pustego prostokąta.
- **Dziennik (U5).** Wykres i „Ostatnie 30 dni” na górze, formularz pod nim, zwinięty do „Dziś: zapisano · Zmień”, jeśli wpis z dziś istnieje (jak w `SymptomsQuick`). Pusta karta własnych objawów zamieniona w wiersz listy „Dodaj własny objaw (0 z 3)” z chevronem.
- **Historia (U4).** „Twój miesiąc” w jednym `.stat-strip` w 3 kolumnach (zużycie, dni, wykup) bez średniej oceny (przeniesiona do wiersza pod spodem). Tekst niezależny od rodzaju gramatycznego: „Najczęściej: Lemon Skunk, 1,7 g”. Porównanie okresów dostarcza A.
- **Recepty (U7).** Ostrzeżenie skrócone do jednego zdania nad listą i linku „Więcej” (pełny tekst w `/pomoc`). „W aptece” połączone z listą „Do wykupienia” w jedną sekcję.
- **Profil (U6).** Podział na sekcje z `.section-label` („Tożsamość”, „Widoczność”, „Linki”) i osobne karty. Pola linków dodawane przyciskiem „Dodaj link”, zamiast trzech pustych pól.
- **Puste stany.** Ujednolicić do `.empty` z ikoną 32 px, tytułem, jednym zdaniem i jedną akcją. Sprawdzić `/compare` (dobre, wzór), „Brak wpisów objawów”, `/historia` przy nowym koncie, kalendarz bez danych. Bez pustej siatki wykresu.
- **Mikrointerakcje (U9).**
  - Jeden komponent potwierdzenia `Toast.js` (`role="status"`, 4 s, opcjonalne „Cofnij”, nad dolnym paskiem, `--surface` + `--shadow-2`). Używają go: zapis zużycia, wykup, wpis objawów, zapis profilu.
  - Przycisk w trakcie zapisu ma `aria-busy` i wskaźnik w miejscu ikony, bez zmiany szerokości.
  - Po zapisie liczba zapasu przechodzi do nowej wartości przez krótkie podświetlenie tła `--accent-soft` (200 ms), a nie przez licznik.
  - Wibracja przy zapisie (MOB-13) tylko w natywnej powłoce i tylko przy `prefers-reduced-motion: no-preference`.
  - Przejścia między ekranami: View Transitions (`vt-active` już istnieje), tylko przenikanie 120 ms.
- **Ikony.** Dopisać w `Icon.js`: `calendar` (kalendarz zużycia), `trend` (porównanie okresów), `clock` (pora przyjęcia), w stylu 24 px i kreska 1,75. Ikona wykresu `chart` zostaje dla stanów pustych.
- **Desktop 1280 px.**
  - „Dziś” w dwóch kolumnach: zapas z prognozą po lewej, zużycie po prawej (już jest, wyrównać wysokości).
  - Historia i dziennik: wykres na pełną szerokość, listy w kolumnie do 680 px.
  - Szczegóły odmiany: zdjęcie i dane w dwóch kolumnach.

Poprawki zasad DESIGN.md (do wpisania przez B w etapie B4):
1. **Liczby.** Fraunces zostaje dla dużych liczb (charakter marki), ale `tabular-nums` tylko tam, gdzie cyfry stoją w kolumnie: tabele, `dl.facts`, osie, odczyt wykresu, liczniki dni w receptach. Duże pojedyncze liczby (`.kpi-big`, `.stat-strip dd b`, oceny) dostają `proportional-nums lining-nums`. Uzasadnienie: z `tabular-nums` „1” w Fraunces stoi luźno („140”, „8,5”), a pojedynczych liczb nikt nie porównuje w pionie.
2. **Kolor danych.** Zielony `--chart-data` jest kolorem danych, a nie akcji. Na wykresach nie ma akcentu interfejsu (`--accent`), więc wybrany słupek to pełny `--chart-data`, a nie obwódka akcentu. Zasada „jeden akcent” dotyczy kontrolek.

## 5. Wydajność i testy

- **Lighthouse** (`scripts/dev/lighthouse.mjs`, mierzy tylko `/login` i `/`). `/` dziś: JS 163 KB przy limicie 195, LCP 3,1 s przy limicie 4,5, CLS 0.
  - Wykresy renderuje serwer. Klient dostaje tylko `Scrub.js` (cel < 3 KB po kompresji) i `Toast.js`.
  - `TodayPanel.js` jest dziś w całości komponentem klienta; jego wykres można przenieść do komponentu serwera tylko wtedy, gdy nie rozbije to `HomeStore`. Jeśli rozbije, wykres zostaje w kliencie, ale bez nowego kodu poza `scale.js`.
  - A mierzy `--port <p>` przed etapem A2 i po nim. Przekroczenie budżetu to regresja, nie powód do podbicia progu.
  - Animacje wejścia tylko na `transform`/`opacity`, wysokości stałe w CSS, więc CLS zostaje 0.
- **Testy jednostkowe.** Nowy `tests/charts.test.js` (A): `niceTicks`, `barPath` (zero, wysokość < 4 px), `smooth` (przerwy, minimum wpisów), formatowanie `pl-PL`, stany kalendarza.
- **`tests/theme.test.js`.** Każdy nowy token w trzech blokach. A1 dopisuje też test, że `--chart-1…7` i `--seq-1…4` nie mają wartości spoza listy w tym dokumencie (zapobiega cichym zmianom palety).
- **Baza.** Każda zmiana SQL (tempo min/max, poprzedni okres, kalendarz, pora w szczegółach) ma przypadek w `tests/db/<obszar>.test.js`.
- **E2E.**
  - `kreator.test.mjs:184` szuka `svg.sym-chart` (w stanie pustym nie może go być). Nowy wykres objawów zachowuje klasę `sym-chart` na każdym panelu albo zmienia test w tym samym commicie.
  - `zielnik.test.mjs` opiera się na `.today-quick` i `.undo-btn`: B nie zmienia tych klas.
  - Nowy scenariusz (A): przesuwanie wykresu klawiaturą na `/` zmienia odczyt (`aria-live`).
- **axe** (`dostepnosc.test.mjs`, oba motywy i „duże cele”). Każdy wykres ma `role="img"` z opisem albo `figure` z `figcaption`. Element do przesuwania ma `tabIndex=0` i dostępną nazwę. Tabela `.sr-only` jest w opakowaniu (wzór z `SymptomsBoard`), żeby strona się nie poszerzała.

## 6. Podział pracy

### Własność plików

| Plik | Właściciel | Uwagi |
|---|---|---|
| `app/globals.css` (tokeny) | **A, tylko etap A1** | B nie dodaje tokenów. Jeśli czegoś potrzebuje, prosi A albo używa istniejących. |
| `app/styles/charts.css` (nowy) i jego import w `app/layout.js` | A (A1) | B dopisuje swoje importy w `layout.js` dopiero po rebase na A1. |
| `app/components/charts/*`, `UsageChart.js`, `Effects.js` | A | |
| `lib/symptoms.js` (kolory, kreski) | A | |
| `app/styles/history.css`, `diary.css` | A tylko w regułach wykresów (`.bars`, `.sym-*`, nowe `.cal-*`), B w pozostałych | Reguły wykresów A przenosi w A1 do `charts.css`, więc potem pliki są rozłączne. |
| `app/styles/home.css`, `detail.css` | jak wyżej: A przenosi `.usage*`, `.ubar*`, `.gauge*`, `.uchart*`, `.meter*`, `.radar*` do `charts.css` w A1 | |
| `TodayPanel.js`, `historia/page.js`, `dziennik/SymptomsBoard.js`, `StrainDetail.js`, `raport/page.js`, `recepty/Prescriptions.js` | **pliki ekranów: B** | A w etapie A1 wyjmuje każdy wykres do `charts/` i zostawia w ekranie jedną linię `<UsageDays … />`, `<SymptomPanels … />` itd. Potem A zmienia tylko pliki w `charts/`, a w ekranie najwyżej przekazanie nowego atrybutu (zgłaszane w opisie commita). |
| `lib/strains.js`, `lib/report.js`, nowe funkcje danych do wykresów | A | B nie zmienia SQL. |
| `app/components/Icon.js`, `Toast.js` (nowy), `navItems.js` | B | Ikony `calendar`, `trend` i `clock` B dodaje w etapie B1, a A ich używa od A3. |
| `docs/DESIGN.md` | A: sekcja „Wykresy” (A1). B: „Liczby”, „Potwierdzenia” (B4). | Różne sekcje. Kto drugi, ten robi rebase. |

### Kolejność

Każdy etap to jeden commit po `npm run check && npm run lint && npm test && npm run build`. Zrzuty 390 px w jasnym i ciemnym motywie dla zmienionych ekranów, 1280 px dla nowych układów (`scripts/dev/shots.mjs`).

**A1 → (B rebase) → równolegle A2…A5 i B1…B4.**

| Etap | Zakres | Kryteria odbioru |
|---|---|---|
| **A1** fundament | Tokeny (sekcja 2) w 3 blokach. Migracja odbiorców według tabeli. `charts.css` z przeniesionymi regułami i importem. `charts/scale.js`, `fmt.js`, `Frame.js`, `Bars.js`, `Scrub.js`, `Empty.js`. Wyjęcie wykresów z `TodayPanel.js`, `historia/page.js`, `SymptomsBoard.js`, `UsageChart.js` do `charts/` **bez zmiany wyglądu** poza kolorem. Dotyczy to także miernika zapasu (`charts/StockGauge.js`, jeden wiersz w `StockBlock`) oraz pustego miejsca na porównanie okresów (`<PeriodCompare … />` w `historia/page.js`, na razie zwraca `null`), żeby A2/B2 i A4/B3 nie edytowały tych samych linii. `tests/charts.test.js`. Sekcja „Wykresy” w DESIGN.md. | `theme.test.js` przechodzi. Zrzuty `/`, `/historia`, `/dziennik`, `/strains/1` przed i po wyglądają tak samo (poza paletą objawów). Lighthouse `/` bez zmian. |
| A2 | Panel „Dziś”: nowe słupki 14 dni (punkt 1) i prognoza zapasu (punkt 2) z funkcją serwera i testem `tests/db`. | Lighthouse `/` w budżecie. Odczyt zmienia się strzałkami. Przy < 14 dniach brak pasma. Tryb dyskretny nie pokazuje nazw. |
| A3 | Dziennik: małe wykresy objawów i panel zużycia (punkt 3). Na desktopie „Osobno / Razem”. | axe w obu motywach. `kreator.test.mjs` przechodzi. Sen widoczny przy równych wartościach. |
| A4 | Historia: słupki z przełącznikiem g/ml (punkt 5), porównanie okresów (punkt 4) z testem `tests/db`. | Podpisy osi w karcie na 320 i 390 px. Różnice bez kolorów stanu. |
| A5 (P2) | Kalendarz, pora przyjęcia, odczucia jako paski, wykresy w raporcie i w druku, oś recept. Każdy osobnym commitem. | Wydruk raportu czarno-biały i czytelny. Kalendarz rozróżnia 4 stany bez koloru. |
| B1 | `Icon.js` (3 ikony), `Toast.js` i podłączenie potwierdzeń, `aria-busy` w przyciskach zapisu. | E2E `zielnik.test.mjs` (`.undo-btn`) przechodzi. |
| B2 | „Dziś” (U1, bez wnętrza wykresów), lista odmian (U2, U3), szczegóły odmiany (kolejność, zdjęcie). | Zrzuty 390 px w obu motywach i 1280 px dla `/` i `/strains/[id]`. Na 390 px „Zużyłem” na pierwszym ekranie. |
| B3 | Dziennik (układ, U5), historia (U4), recepty (U7), profil (U6), puste stany. | axe. Zrzuty 390 px w obu motywach. |
| B4 | Typografia liczb (poprawka zasad), mikrointerakcje (podświetlenie, View Transitions), poprawki DESIGN.md. | Zrzut 320 px dla `/`. `prefers-reduced-motion` wyłącza wszystko (sprawdzić emulacją w Playwright). |

Unikanie konfliktów:
- B zaczyna od B1 (pliki tylko B) w trakcie A1.
- B2 i B3 startują dopiero po rebase na A1, bo wtedy wykresy są już wyjęte z plików ekranów.
- A po A1 nie zmienia znaczników ekranów poza przekazaniem danych do komponentu wykresu. Jeśli musi, opisuje to w commicie, a B robi rebase przed kolejnym etapem.
- Nikt nie zmienia `CHANGELOG.md`, wersji ani `docs/HANDOFF.md`; to robi koordynator przy wydaniu.

### Do ręcznego testu na telefonie (po A2, A3, B2)

- Przesuwanie palcem po wykresie nie przewija strony w poziomie, a pionowe przewijanie działa (`touch-action: pan-y`).
- Czytelność 12 px pod osią na prawdziwym ekranie.
- Kalendarz kwartału: trafianie w komórki 20 px.
- Natywna powłoka Android: `vt-active` i `kbd-open` przy formularzu dziennika.
- TalkBack: odczyt `aria-live` po przesunięciu.

## 7. Ryzyka

- **`TodayPanel` jest komponentem klienta z `HomeStore`.** Przeniesienie wykresu do serwera może być niemożliwe bez przebudowy stanu. Wtedy wykres zostaje w kliencie, a budżet JS pilnowany jest pomiarem.
- **Prognoza z pasmem może być odebrana jako „przewidywanie leczenia”.** Podpis zawsze mówi „przy obecnym tempie zapisów”, a pasmo „zakres z ostatnich 4 tygodni”.
- **Zmiana palety objawów** zmienia kolory, do których przyzwyczaili się obecni testerzy bety. Dlatego zmiana jest jedna, w A1, z wpisem „Co nowego”.
- **Wyjęcie wykresów w A1** dotyka plików ekranów, nad którymi potem pracuje B. Jeśli A1 się opóźni, B pracuje tylko nad B1. Etapy B2 i B3 nie startują przed scaleniem A1.
- **Kalendarz roczny na 390 px** jest nieczytelny, dlatego rok pokazujemy tylko na desktopie albo jako 4 kwartały jeden pod drugim.
