# System projektowy Zielnika

Krótki przewodnik dla każdego, kto zmienia wygląd aplikacji. Kod: tokeny i komponenty bazowe w `app/globals.css`, style ekranów w `app/styles/*.css` (kolejność importu w `app/layout.js`), ikony w `app/components/Icon.js`.

Od 9.10.2026 obowiązuje **Design 3** (kierunek B „Dashboard zdrowia” z elementami A): diagnoza, makiety, finalne tokeny z kontrastem i plan strumieni są w `docs/DESIGN-3.md` (sekcja 0). Zasady 3–5 poniżej zastąpiły dawne „hierarchia zamiast ozdobników”, „jeden akcent” i „listy zamiast kart”.

## Zasady

1. **Spokojnie i rzetelnie.** Odbiorcy to dorośli pacjenci, a dane dotyczą zdrowia. Ton jak w aplikacji apteki albo dzienniku zdrowia, bez „stonerskiej” estetyki i marketingu.
2. **Telefon przede wszystkim.** Ok. 90% użyć to telefon, w tym natywna powłoka Android (`html.native-app`). Projektuj najpierw na 390 px, potem sprawdź 320 px i 1280 px.
3. **Kolor oznacza obszar.** Sześć obszarów ma własny kolor (`data-cat`):
   - zapas i zużycie: `stock`
   - dziennik i objawy: `journal`
   - recepty: `rx`
   - odmiany: `strain`
   - społeczność: `social`
   - wiedza i raport: `learn`

   Kolor pojawia się w ikonie sekcji (`.ic-dot`), tle karty z tematem (`.card.tint`), aktywnej zakładce i wybranym chipie. Ikona i tekst na tle tonalnym mają zawsze kolor `--cat-*-ink`. Pełne wypełnienie (`.solid`, `--cat-*` z `--on-cat`) jest tylko w hero i w najwyżej dwóch kaflach KPI na ekranie „Dziś”. Na pozostałych ekranach jedyną pełną plamą koloru jest hero albo przycisk główny.
4. **Jedna rzecz najważniejsza na ekranie.** Każdy ekran ma jednego „bohatera”: hero z gradientem od `--bar` albo kartę tonalną z jedną dużą liczbą (`.big-num`, Figtree 800). Akcja główna ma zawsze kolor `--btn`, niezależnie od obszaru. Kolor stanu (`--warn`, `--danger`) pojawia się tylko wtedy, gdy jest powód; informacja ma neutralne tło (`--surface-2`). Kolory rodzaju odmiany (`--kind-*`) to nadal znacznik danych (kropka, miniatura, chip filtra), a nie kolor obszaru.
5. **Warstwy zamiast linii.** Karty i listy mają miękki cień (`--shadow-card`) i promień 18, więc odcinają się od tła. Linie zostają wewnątrz kart (wiersze `.list`, `.facts`). Karta w karcie nie ma drugiego cienia. Powtarzalne pozycje to nadal wiersze w jednej karcie, nie osobne karty.
6. **Każdy stan ma wygląd.** Każdy ekran ma stan pusty (`.empty` z ikoną, zdaniem wyjaśnienia i jedną akcją), stan ładowania (szkielet `Skeleton`) i stan błędu (`.alert.error` z `role="alert"`).
7. **Dostępność.** Kontrast tekstu co najmniej 4,5:1 (WCAG AA) w obu motywach. Cele dotykowe mają co najmniej 44 px, a pola tekstowe czcionkę 16 px. Fokus z klawiatury musi być widoczny. Ruch szanuje `prefers-reduced-motion`.

## Tokeny

Kolory definiujemy wyłącznie jako zmienne CSS. W JSX i nowym CSS nie wpisuj wartości hex. Tryb ciemny ma dwa bloki, które muszą być identyczne: wybór ręczny `:root[data-theme="dark"]` i ustawienie systemu `@media (prefers-color-scheme: dark)`. Pilnuje tego `tests/theme.test.js`.

### Kolory

| Token | Jasny | Ciemny | Użycie |
|---|---|---|---|
| `--bg` | #edf1f4 | #0b1114 | tło strony |
| `--surface` | #ffffff | #141c20 | karty, listy, dolny pasek |
| `--surface-2` | #f2f5f7 | #1b252a | wypełnienia: tor przełącznika, pola w karcie, znaczniki |
| `--surface-3` | #e5ebef | #243037 | wciśnięcie, zaznaczony segment (ciemny) |
| `--field-bg` | #ffffff | #10181c | tło pól formularza |
| `--sep` / `--sep-strong` | #e0e6ea / #c3cdd4 | #223038 / #36464f | linie / ramki pól i przycisków drugorzędnych |
| `--text` | #0f1b1f | #e8eef1 | tekst główny |
| `--text-2` | #475760 | #a4b2b9 | tekst drugorzędny, etykiety (6,6:1 / 8,7:1 na tle) |
| `--text-3` | #5b6b73 | #87969d | podpowiedzi, placeholder, chevrony (min. 4,87:1) |
| `--accent` / `--on-accent` | #0f6b52 / #fff | #4fd1a5 / #05231a | zaznaczenie, przełącznik, fokus (nie przycisk główny) |
| `--btn` / `--on-btn` | #0f6b52 / #fff | #0f7a5c / #fff | przycisk główny (6,5:1 / 5,3:1) |
| `--accent-text` | #0f6b52 | #6fdcb7 | linki, przyciski tekstowe |
| `--accent-soft` / `--on-accent-soft` | #d9f0e7 / #0a4a39 | #12322a / #a6ecd3 | wybrany chip, aktywna zakładka bez obszaru |
| `--bar` / `--on-bar` | #1d3b27 / #eef1e8 | bez zmian | górny pasek i ekran blokady; **sprzężony** z paskiem stanu (`mobile/capacitor.config.js`, `themeColor` w `app/layout.js`), nie zmieniaj go osobno |
| `--warn`, `--warn-soft`, `--warn-line` | | | ostrzeżenia: recepta wygasa, „Kończy się”, termin ważności |
| `--danger`, `--danger-soft`, `--danger-line` | | | błędy i akcje nieodwracalne |
| `--ok`, `--ok-soft` | | | potwierdzenia zapisu |
| `--kind-indica`, `--kind-sativa`, `--kind-hybryda` | | | znacznik rodzaju odmiany |
| `--cat-<obszar>`, `-soft`, `-ink`, `--on-cat` | | | kolory obszarów (`stock`, `journal`, `rx`, `strain`, `social`, `learn`): wypełnienie z `--on-cat`, tło tonalne, tusz; wartości w `docs/DESIGN-3.md` |
| `--hero-2`, `--hero-3`, `--on-hero`, `--on-hero-2`, `--hero-btn-2` | | | hero: gradient `--bar` → `--hero-2` → `--hero-3`, tekst, podpisy, przycisk drugorzędny |
| `--shadow-card`, `--card-line` | | | cień i linia kart |
| `--scrim`, `--hover-bg`, `--press-bg` | | | zasłona pod arkuszem, najechanie, wciśnięcie |

Dawne nazwy (`--paper`, `--card`, `--card-alt`, `--line`, `--ink`, `--muted`, `--hemp`, `--hemp-deep`, `--leaf`, `--resin`, `--lilac`, `--input-bg`, `--shadow`) są aliasami nowych tokenów. Zostają dla zgodności z istniejącym kodem, ale w nowym kodzie ich nie używaj. Uwaga: `--hemp-deep` oznacza teraz wyłącznie kolor paska (`--bar`), a nie kolor tekstu.

### Typografia

- **Jeden krój: Figtree** (`--font-body`). `--font-display` wskazuje na ten sam krój (Fraunces wypadł w Design 3), więc tytuły i liczby różnią się tylko grubością: `h1` i duże liczby 800, `h2`/`h3` i przyciski 700, tekst 400–500. Liczby zawsze z `font-variant-numeric: tabular-nums lining-nums`.
- **Skala:** 12 (`--fs-xs`, podpisy pod liczbami, plakietki), 14 (`--fs-sm`, etykiety pól, tekst pomocniczy), 16 (`--fs-md`, tekst), 17 (`--fs-lg`, tytuły w ustawieniach, `h3`), 20 (`--fs-xl`, `h2`), 24 (`--fs-2xl`), 30 (`--fs-3xl`, `h1` na desktopie; na telefonie 28).
- Interlinia 1,5 dla tekstu i 1,2 dla nagłówków. Grubość 700 dla nagłówków i przycisków, 800 dla `h1` i dużych liczb, 500 dla wartości w listach.

### Odstępy, promienie, cienie, ruch

- **Odstępy** w siatce 4 px: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 20, `--s-6` 24, `--s-8` 32, `--s-10` 40, `--s-12` 48. Margines boczny strony to 16 px na telefonie i 20 px na desktopie. Odstęp między kartami: 16 px.
- **Promienie:** `--r-sm` 6 (plakietki, znaczniki), `--r-md` 12 (przyciski, pola), `--r-lg` 18 (karty, listy, kafle), `--r-xl` 24 (hero, górne rogi arkusza), `--r-pill` (chipy filtrów, wskaźnik zakładki).
- **Cienie:** karty, listy i kafle mają `--shadow-card` (miękki, w ciemnym motywie z linią `--card-line`). Warstwy nad treścią (arkusz, menu, „+”) mają `--shadow-2`, zaznaczony segment `--shadow-1`. Karta tonalna (`.tint`) nie ma cienia.
- **Ruch:** `--dur-1` 120 ms (kolor, tło) i `--dur-2` 200 ms (wysunięcie arkusza, obrót chevrona), krzywa `--ease`. Przy `prefers-reduced-motion: reduce` animacje i przejścia są wyłączone globalnie.

## Komponenty

- **Przyciski** (`.btn`, wysokość 44): główny `.btn` to wypełnienie `--btn` (w ciemnym motywie ciemny szmaragd z białym tekstem, nie mięta), jeden na ekran lub sekcję. Miękki `.btn.soft` ma tło obszaru (`--c-soft`) i służy do akcji z kolorem, np. „Zużyłem” na karcie. Na hero `.btn` jest biały, a `.btn.ghost` przyciemniony (`--hero-btn-2`). Drugorzędny `.btn.ghost` ma tło powierzchni i ramkę `--sep-strong`. Tekstowy `.btn.text` nie ma tła; używaj go do akcji w stopce karty i w paskach. Niebezpieczny `.btn.danger` służy do usuwania. `.btn.small` (36 px na desktopie, 44 px przy dotyku) to wersja do gęstych miejsc. `.btn.block` zajmuje pełną szerokość. Ikona w przycisku ma 18–20 px i stoi przed tekstem.
- **Pola** (`.field` > `label` + `.input`): etykieta nad polem (14 px, 600). Pole ma wysokość 44 i promień 10, a fokus to ramka akcentu z pierścieniem `--ring`. Błąd pola: `.field-err` pod polem i `aria-invalid`. Dla wartości liczbowych zawsze `inputMode`.
- **Przełącznik** (`input.switch` w `.switch-row`, `role="switch"`): ustawienia włącz/wyłącz. Zwykły `.check` zostaje dla zgód i filtrów.
- **Listy** (`.list` > `.list-row`): wiersz ma co najmniej 52 px; ikona 24 px w `--text-2`, potem `.lr-main` (tytuł i opcjonalny `.lr-sub`), `.lr-value` (wartość) i `.lr-chev` (chevron dla nawigacji). **Lista faktów** (`dl.facts`) układa etykietę po lewej i wartość po prawej, liczby w `tabular-nums`.
- **Sekcje:** `.card` to powierzchnia z cieniem `--shadow-card` i promieniem 18. Sekcja z tematem to `.card.tint` z `data-cat` (tło `--cat-*-soft`), a jej nagłówek to `.sec-head` (kółko `.ic-dot`, `h2`, akcja). Nad grupą kart stawiaj `.section-label` (14 px, 700, `--text-2`, zdaniowa pisownia; jeden styl etykiet w całej aplikacji, bez wersalików).
- **Obszary i kafle (Design 3):** `data-cat` ustawia `--c`, `--c-soft` i `--c-ink`. `.ic-dot` to ikona w kółku (`.sm`, `.sq`, `.solid`, `.warn`); w nagłówku karty tonalnej kółko jest białą wyspą (ikona `--c-ink`), nie `.solid`. `.kpi-tile` (`.kt-label`, `.kt-value`, `.kt-sub`) to liczba w kaflu, a jego wariant `.solid` stosuj oszczędnie (patrz zasada 3); `.kpi-tile.warn` tylko wtedy, gdy jest powód do ostrzeżenia. `.big-num` to duża liczba. `.day-count` to licznik dni (liczba i podpis w kafelku tonalnym obszaru; `.sm`, `.soon` ostrzeżenie do 7 dni, `.past` po terminie), ten sam na „Dziś” i w Receptach.
- **Hero:** `.hero` to nagłówek z gradientem od `--bar` (tylko „Dziś” i szczegóły odmiany); na telefonie ma pełną szerokość i łączy się z górnym paskiem. Ekrany drugiego poziomu mają `.hero.cat-hero` z `data-cat` (dziennik i obserwacje `journal`, recepty `rx`, historia `stock`, raport `learn`): karta z gradientem od `--c` do `--c` przyciemnionego czernią, tekst i podpisy w `--on-cat` (kontrast obu końców pilnuje `tests/theme.test.js`), układ `.hero-top` (kółko i tytuł) i `.hero-actions` (przyciski; na komputerze do 240 px szerokości). To jedyna pełna plama koloru na tych ekranach.
- **Notki i trend:** `.priv-note` to neutralna notka (tło `--surface-2`, ikona `info`) dla informacji o prywatności i charakterze danych; `.alert.note` zostaje dla prawdziwych ostrzeżeń. `.pill-trend` to opisowa pigułka trendu w kolorze obszaru (bez zieleni i czerwieni, bo nie oceniamy kierunku).
- **Akcje w wierszach list** (historia zakupów i zużycia, czat): przyciski tekstowe (`.btn.text.small`, cel 44 px), bez ramek i bez czerwieni w każdym wierszu; usuwanie i tak prosi o potwierdzenie. Opcje wiadomości w czacie („…”) stoją obok dymka.
- **Nagłówek ekranu:** `h1` w `.page` (opcjonalnie `.page-head` z akcją po prawej albo `.hero`). Powrót: `.back` z ikoną `chevronLeft`. Przełącznik widoków jako linki: `.seg.seg-links` z `a.on` (np. Moje / Katalog / Rankingi).
- **Pasek liczb** (`.stat-strip`): 2–3 kluczowe liczby w jednej karcie z pionowymi liniami (historia, raport, admin). Nie rób osobnego kafla dla każdej liczby.
- **Panel „Dziś”** (strona główna, `TodayPanel.js`, `app/styles/home.css`): jedna duża liczba (zapas, Fraunces 48 px) i prognoza, miernik dni względem 30 dni, wykres zużycia z 14 dni (słupki inline SVG w `--chart-data`, wybrany dzień pełnym kolorem, pozostałe przygaszone, oś tylko `dd.mm` i „dziś”), szybkie „Zużyłem” i karta recept z odliczaniem. Kolor `--warn` tylko przy zapasie poniżej progu lub < 7 dni i przy recepcie wygasającej w ciągu 7 dni.
- **Nawigacja:**
  - Górny pasek (`--bar`, na telefonie znak marki i ikona profilu; desktop: Dziś, Odmiany, Dziennik objawów, Recepty, Katalog, Szukaj, Znajomi).
  - Dolny pasek: Dziś, Odmiany, „+” w środku (`.fab`, menu dodawania), Dziennik, Więcej. Aktywna zakładka ma kolor swojego obszaru (`data-cat`). Na „Więcej” jest plakietka zaproszeń.
  - Arkusz „Więcej”: grupy „Dziennik”, „Odkrywaj”, „Społeczność”, „Konto”, ikony w kółkach w kolorach obszarów, Eksport i Import CSV w „Konto”.
  - Pozycje menu definiuje się tylko w `app/components/navItems.js` (pola `icon`, `cat`, `short`, `file`, `sheet` = grupa).
  - Strona główna `/` to tylko panel „Dziś”, a lista odmian jest na `/odmiany`.
- **Arkusze:** wysuwane od dołu, tło `--bg`, uchwyt 36×4 px, `--scrim` pod spodem, Escape zamyka. Formularz odmiany na telefonie otwiera się jako pełnoekranowy arkusz (`.strain-form` + `.mobile-form-bar`).
- **Przełącznik segmentowy** (`.seg`): 2–4 wzajemnie wykluczające się widoki. Przy większej liczbie opcji użyj `select` albo chipów.
- **Chipy** (`.chip`): filtry wielokrotnego wyboru; wybrany ma `.on`. Małe znaczniki (`.chips.small .chip`, `.chip.tag`) to nieinteraktywne etykiety, na przykład terpeny i tagi efektów.
- **Plakietki** (`.badge`), oszczędnie: tylko stan (`.badge.low` dla ostrzeżeń) i rola. Pierwsza litera jest automatycznie wielka, reszta zostaje bez zmian. Nie dawaj plakietki zwykłej informacji typu „Haze”; to zwykły tekst w linii meta z separatorem „·”.
- **Puste stany** (`.empty`): ikona 32 px w `--text-3`, tytuł, jedno zdanie wyjaśnienia i jedna akcja.
- **Komunikaty** (`.alert.note | .error | .ok`) wyświetlaj nad treścią, której dotyczą, bez ikon emoji.

## Wykresy

Wszystkie wykresy są w `app/components/charts/` (inline SVG, bez zależności), reguły w `app/styles/charts.css`, plan i uzasadnienia w `docs/UI-2.md`. Ekran dostaje wykres jedną linią (`<UsageDays />`, `<WeeklyBars />`, `<SymptomsChart />`, `<UsageWeeks />`, `<StockGauge />`), nie rysuje własnego SVG.

- **Moduł.** `scale.js` (skala, „ładne” podziałki, ścieżka słupka, wygładzanie) i `fmt.js` (liczby po polsku, daty z łańcuchów ISO) to czyste funkcje z testami w `tests/charts.test.js`. `Frame` (figure: tytuł, odczyt `aria-live`, oś X w HTML, tabela `.sr-only`), `Bars`, `Scrub` (wyspa klienta: wybór palcem i klawiaturą), `Empty` (brak danych, mało danych).
- **Kolor.** Wykres bierze kolor wyłącznie z tokenów, w obu motywach: `--chart-data` (jedna seria), `--chart-ref` (porównanie), `--chart-band`, `--chart-grid`, `--chart-axis`, `--chart-zero`, `--seq-1…4` (rosnąca ilość, jeden odcień), `--chart-1…7` (kategorie, tylko gdy seria jest tematem, najwyżej 3 naraz). Paletę sprawdza walidator (skill dataviz) i `tests/theme.test.js`; zmiana wartości wymaga nowej walidacji. `--accent` i `--kind-*` nie są kolorami serii.
- **Reguły.** Jedna oś Y na wykres (dwie wielkości to dwa wykresy). Liczba tylko przy wybranym, maksymalnym albo ostatnim punkcie. Tekst zawsze w `--text-2` / `--text-3`, nigdy w kolorze serii. Siatka i osie 1 px. Każda wartość jest też w tabeli `.sr-only` (w opakowaniu, żeby nie poszerzała strony), wykres ma `role="img"` z opisem. Wysokość stała w CSS, podpisy osi w HTML (zero CLS, tekst 12 px bez skalowania).
- **Zachowane na potrzeby testów:** klasy `svg.sym-chart` (E2E szuka jej w stanie pustym), `.ubar`, `.usage-chart`, `.uchart-plot`.
- **Tryb dyskretny.** Wykresy nie pokazują nazw odmian. Jeśli nowy wykres je pokaże, nazwa idzie w `.dn`.

## Ikony

Używamy jednego zestawu liniowego z `app/components/Icon.js`: siatka 24 px, kreska 1,75, zaokrąglone końce, kolor z `currentColor`. Nową ikonę dopisz tam w tym samym stylu. Nie używaj emoji ani znaków („×”, „▾”, „+”) w roli ikon, nie mieszaj bibliotek. Liść marki (`Leaf`) pojawia się tylko jako znak marki w górnym pasku i na ekranie logowania, bo tryb dyskretny go ukrywa. Nie używaj go jako ikony funkcji. Odmiana to słoik (`jar`), olej i pen to kropla (`drop`), Dziś to dom (`home`). Ikona sekcji stoi w kółku `.ic-dot` w kolorze obszaru. Mikroilustracje (puste stany, brak zdjęcia) rysuj z prostych kształtów w kolorach obszarów, bez liści i postaci.

## Treść

- Pisz krótko i rzeczowo, bez wykrzykników i bez marketingu. Zwracaj się do użytkownika na „Ty” tam, gdzie to naturalne.
- Liczby zawsze podawaj z jednostką i polskim przecinkiem dziesiętnym: „12,75 g”, „0,5 g/dzień”, „45 zł/g”, „THC 22%”. W komponentach używaj `toLocaleString('pl-PL')` albo `dec()` z `StrainCard.js`.
- Przyciski nazywaj czasownikiem albo rzeczownikiem akcji: „Zapisz zużycie”, „Dodaj odmianę”. Nie używaj „OK” ani „Kliknij tutaj”.
- Daty pisz w formacie `d MMMM yyyy` (`toLocaleDateString('pl-PL')`) w tekście, a `dd.mm` na osiach wykresów.
- Teksty medyczne zostają ostrożne: „poglądowo”, „nie zastępuje porady lekarza”.

## Tryb dyskretny i aplikacja natywna (nie psuć)

- Klasy `.dn` i `.dn-img` (rozmycie nazw i zdjęć), `.brand`, `.brand-name` i `.brand-alt` (podmiana nazwy na „Notatnik”; podwójne dotknięcie `.brand` przełącza tryb). Reguły są w `app/styles/platform.css`.
- Klasy `html.native-app`, `kbd-open` i `vt-active`, elementy `.ptr` i `.native-offline`, wcięcia bezpiecznych obszarów (`--safe-area-inset-*`). Reguły są w `platform.css`, który jest ładowany jako ostatni.
- Zmiana koloru `--bar` wymaga też zmiany `mobile/capacitor.config.js` i `themeColor`, bo ikony paska stanu są jasne (`StatusBar` `DARK`).

## Audyt 2026-10 (stan przed wdrożeniem systemu)

Zrzuty: 390 px jasny i ciemny oraz 1280 px, wszystkie główne ekrany.

1. Tło strony z gradientowymi plamami (zielona i fioletowa), wszystko w kartach o promieniu 22 px.
2. W trybie ciemnym jasne „plamy”: przełączniki segmentowe, plakietki, `.alert.note`, `.klist`, `code`, pozycje rankingów miały kolory hex tylko dla trybu jasnego. Link „← Wszystkie odmiany” był niemal niewidoczny, bo `--hemp-deep` służył jednocześnie za tło paska i kolor tekstu.
3. Trzy kolory akcentu naraz: zielony przycisk, pomarańczowy „+” i aktywna zakładka, fioletowe akcenty. Pas koloru 7 px po lewej stronie każdej karty.
4. Plakietka dla każdej informacji (rodzaj, typ, postać, THC, CBD, cena, ocena). `text-transform: capitalize` dawał „Ważne Jeszcze 18 Dni”.
5. Ocena w ciemnym kaflu, kafle „Twój miesiąc” w ciemnozielonych blokach. Liczby z kropką dziesiętną („12.75 g”).
6. Strona główna: 5 akapitów statystyk nad listą, przycisk „Dodaj odmianę” i „Filtry” jako osobne pełne wiersze, a lista zaczynała się poniżej pierwszego ekranu.
7. Karta na telefonie: zwinięta i tak pokazywała formularz zużycia z chipami. Stopka przepełniała szerokość (poziome przewijanie na 390 px).
8. Arkusz „Więcej”: płaska lista 12 pozycji bez ikon, bez wylogowania. Przycisk „+” przykrywał arkusz i ostatnią treść. Zakładka „Odmiany” z liściem konopi była widoczna w trybie dyskretnym.
9. Górny pasek na telefonie: nazwa użytkownika i „Wyloguj” zajmowały miejsce, a aktywna strona na desktopie nie była zaznaczona.
10. Logowanie: wielki liść i hero na pół ekranu telefonu, przycisk nie na całą szerokość.
11. Profil: kolejność przypadkowa (powiadomienia przed profilem), pola wyboru zamiast przełączników, eksport jako trzy pigułki.
12. Ikony: mieszanka liścia, własnych SVG i znaków tekstowych („+”, „×”, „▾”).
13. Pozostałe: tabele w panelu admina przepełniają szerokość telefonu. Wykres dziennika ma stałe kolory i nie dopasowuje się do motywu. Daty w polu dnia w formacie przeglądarki, a w kilku miejscach kreska „—” w tytułach.

## Przegląd dopracowania 2026-10

Zrzuty 390 px (jasny, ciemny) i 1280 px po wdrożeniu systemu. Cel: wygląd dopracowanej aplikacji natywnej, bez „pudełek w pudełkach” i nadmiaru akcentu. Kolejność według tego, jak często ekran jest oglądany.

| # | Ekran, element | Problem | Poprawka |
|---|---|---|---|
| 1 | Odmiany, zwinięta karta (telefon) | Każda karta pokazuje szare pudełko z trzema polami („Ocena”, „Mam teraz”, „Do wykupienia”). Lista wygląda jak formularz, karta ma dwukrotną wysokość, na ekran mieści się jedna odmiana. | Zwinięta karta to wiersz: nazwa, dane, ocena, szybkie akcje „Zużyłem/Wykupiłem” i stan. Pola edycji dopiero po „Szczegóły”. Koszt: przy stanie 0 g i 0 g do wykupienia (brak szybkich akcji) wpisanie zapasu wymaga jednego dotknięcia więcej. |
| 2 | Odmiany, rozwinięta karta | Pola użytkownika w szarym pudełku wewnątrz karty (karta w karcie). Pola ceny i widoczności węższe (260 px) niż pozostałe, prawa krawędź poszarpana. | Na telefonie bez tła, oddzielone linią jak sekcja; wszystkie pola na pełną szerokość. |
| 3 | Odmiany, stopka karty | Trzy kontrolki w kolorze akcentu obok siebie („Szczegóły”, „Porównaj”, „Edytuj”). Akcent przestaje oznaczać główną akcję. | „Szczegóły” zostaje w akcencie, „Porównaj” i „Edytuj” w `--text-2`. |
| 4 | Szczegóły, wpisy innych osób | „Ocena” i „Opinia” jako etykieta nad wartością z dużymi odstępami; jeden wpis zajmuje ćwierć ekranu. | Etykieta i wartość w jednej linii („Ocena 7,5”). |
| 5 | Szczegóły, karta charakterystyki | Druga lista faktów w innym stylu niż pierwsza (gruba etykieta, odstęp 10 px), stężenie z kropką („CBD 0.5%”). | Ten sam rytm co `.facts` (12 px, etykieta zwykła, wartość 500), liczby przez `fx()` z przecinkiem. |
| 6 | Szczegóły, „Odczucia użytkowników” | Pięć pogrubionych pigułek z liczbami w nawiasach, zawijanych w nierówne rzędy, styl inline. | Lista faktów: efekt po lewej, „4/10 · 1 ocena” po prawej, liczby tabelaryczne. |
| 7 | Dolny pasek | Przy otwartym arkuszu „Więcej” podświetlone są dwie zakładki naraz („Odmiany” i „Więcej”). | Gdy arkusz jest otwarty, aktywna jest tylko „Więcej”. |
| 8 | Arkusz „Więcej” | Linie między wierszami biegną od krawędzi, przez kolumnę ikon; bieżąca strona nie jest wyróżniona. | Linie zaczynają się od tekstu (wcięcie 52 px, jak w ustawieniach iOS), bieżąca pozycja pogrubiona. |
| 9 | Rankingi | Trzy przełączniki segmentowe o trzech różnych szerokościach jeden pod drugim, przycisk filtrów wisi obok drugiego. | Na telefonie siatka: „Wspólne/Moje” + filtr w pierwszym rzędzie, pozostałe przełączniki na pełną szerokość. |
| 10 | Przełączniki segmentowe (katalog, profil, dziennik, koło) | Szerokość „do treści”, więc każdy kończy się w innym miejscu i nie trzyma prawej krawędzi. | Na telefonie (≤ 480 px) pełna szerokość i równe segmenty, jak systemowy `UISegmentedControl` (bez zakładek panelu admina). |
| 11 | Profil, „Wygląd” | Przełącznik przyklejony do nagłówka (0 px odstępu). | Odstęp 12 px. |
| 12 | Profil, nagłówek | Awatar i nazwa zlewają się z polami formularza poniżej. | Linia oddzielająca tożsamość od pól; pole „Kto widzi mój profil” na pełną szerokość jak pozostałe. |
| 13 | Profil, rząd przycisków | Pusty komunikat stanu (`role="status"`) zajmuje miejsce w rzędzie, przez co „Udostępnij” jest węższy od karty o odstęp. | Pusty komunikat jest ukryty. |
| 14 | Przełącznik segmentowy, tryb ciemny | Wybrany segment (`--surface-3` na `--surface-2`) prawie nie odróżnia się od pozostałych. | Obwódka `--sep-strong` wokół wybranego segmentu w obu blokach ciemnego motywu. |
| 15 | Odmiany, ostrzeżenie o receptach | Przy dwóch receptach blok 15 px zajmuje 1/4 pierwszego ekranu. | Na telefonie 14 px i ciaśniejsza interlinia; treść bez zmian. |

Zostaje do decyzji lub ręcznej kontroli:
- Przycisk „+” (56 px, cień) przykrywa prawy dolny róg treści na każdym ekranie, także tam, gdzie nie ma sensu dodawać odmiany (rankingi, katalog). Wyświetlanie tylko na liście odmian to zmiana zachowania, nie wyglądu.
- Ostrzeżenie o receptach: przy wielu receptach nadal kilka akapitów; do rozważenia jedno zdanie z liczbą i link (zmiana treści).
- Przycisk „+” i przyciski główne w ciemnym motywie (jasna mięta `--accent`) są najjaśniejszym elementem ekranu; do rozważenia ciemniejsze wypełnienie przy zachowaniu kontrastu `--on-accent`.
- W zrzutach z Chromium bez GPU (dpr 2) Figtree ma nierówne odstępy między literami („Znajom i”). Na 1280 px tego nie ma; sprawdzić na prawdziwym telefonie, nie poprawiać `letter-spacing` na ślepo.

## Do przeniesienia na system

Ekrany poniżej korzystają już z nowych tokenów: tryb ciemny działa, a karty, przyciski, pola i przełączniki segmentowe są w nowym stylu. Ich układ nie był jednak jeszcze przeprojektowany. Paczki są niezależne. Każda paczka zmienia tylko swoje pliki, a swój blok CSS przenosi z `app/styles/screens.css` do nowego pliku `app/styles/<ekran>.css`, z importem w `app/layout.js` przed `platform.css`. W `screens.css` usuwa tylko własny blok, żeby paczki się nie nakładały. Nie zmieniaj `globals.css` poza dopisaniem brakującego komponentu bazowego; taką zmianę zgłoś w raporcie.

**A. Katalog i wyszukiwanie** (`app/katalog/CatalogBoard.js`, `app/katalog/[id]/page.js`, `app/szukaj/page.js`; blok „Katalog” w `screens.css`)
- `.cat-item` zamienić na wiersze listy (`.list-row`): nazwa (Fraunces 17), linia meta „Producent · ● Rodzaj · THC 22%”, stan „niedostępna” jako tekst `--text-2` zamiast przezroczystości 0,6.
- Pusty katalog: `.empty` z ikoną `book` i akcją dla admina.
- Szukaj: grupy wyników z `.section-label`, osoby jako `.list-row` z awatarem.

**B. Rankingi i koło** (`app/rankings/Rankings.js`, `app/wheel/Wheel.js`; bloki „Rankingi” i „Koło fortuny”)
- Filtry rankingów schować do zwijanego panelu, tak jak na stronie głównej (przycisk z ikoną `filter` i licznikiem). Dziś zajmują cały pierwszy ekran.
- `.seg` z czterema opcjami zawija się w dwie linie: zamienić na `select` albo poziomo przewijane chipy.
- Koło: kolory segmentów na canvasie z tokenów (`getComputedStyle(document.documentElement).getPropertyValue('--kind-…')`). Wskaźnik i środek koła w kolorze akcentu, bez pomarańczowego.

**C. Historia i raport** (`app/historia/page.js`, `app/raport/page.js`, `app/components/StrainHistory.js`; bloki „Historia” i „Raport”)
- „Twój miesiąc”: tytuł bez kreski („Październik 2026”), liczby z przecinkiem (`toLocaleString('pl-PL')`), `.recap-grid` jako `.stat-strip`.
- Wykres słupkowy (inline SVG z `var(--hemp)`): oś i podpisy w `--text-2`, wartości z przecinkiem, wyższe słupki z zaokrągleniem 4 px.
- Tabele `.cmp` na telefonie zamienić na listy faktów albo karty wierszy.
- Raport: sprawdzić wydruk (`@media print` w `platform.css`) i tryb ciemny.

**D. Dziennik objawów i recepty** (`app/dziennik/SymptomsBoard.js`, `app/recepty/Prescriptions.js`; blok „Dziennik objawów”)
- Kolory linii wykresu są wpisane w JS (4 wartości hex): przenieść je na tokeny (`--chart-1…4` w `globals.css`, w obu motywach), żeby miały kontrast na ciemnym tle.
- Suwaki objawów: wartość liczbowa obok etykiety (`tabular-nums`) zamiast „–”, przycisk „Wyczyść” jako `.btn.text`.
- Pole „Dzień” z przyciskami „Wczoraj / Dziś”.
- Recepty jako lista: data, ilość, pasek wykupu (`progress` w kolorze akcentu przez `accent-color`), ostrzeżenie `.badge.low`. Usunąć `style={{ justifyContent }}`.
- Uwaga: plik `Prescriptions.js` zmieniało już scalenie natywne (`useNativeRefresh`); nie usuwaj tego wywołania.

**E. Społeczność: znajomi, grupy, profil publiczny** (`app/znajomi/FriendsBoard.js`, `app/grupy/*`, `app/u/[handle]/page.js`; blok „Profil publiczny, znajomi, grupy”)
- `.people` i `.person` jako `.list` z awatarem 40 px, akcje jako `.btn.small` po prawej, zaproszenia oczekujące nad listą z `.section-label`.
- Profil publiczny: nagłówek jak w `/profil` (`.profile-id`), oceny i testy jako lista.
- Zachować `useNativeRefresh` w `FriendsBoard.js` i `GroupsBoard.js`.

**F. Wiedza, premium, prywatność** (`app/wiedza/page.js`, `app/premium/page.js`, `app/prywatnosc/page.js`; blok „Wiedza”)
- `.knav` jako poziomo przewijany pasek na telefonie. Karty terpenów jako lista z rozwijaniem.
- Premium: porównanie planów jako lista faktów zamiast tabeli, jedna akcja główna, bez wykrzykników.
- Szerokość czytania tekstu do 68 znaków (`max-width: 68ch`).

**G. Panel admina** (`app/admin/*`; blok „Panel admina”)
- Tabele (`.table`, `.cmp`) przepełniają szerokość 390 px: na telefonie zamienić na listy wierszy (użytkownik, rola, status, akcje w menu).
- Statystyki jako `.stat-strip` w dwóch rzędach zamiast 9 kafli.

**H. Formularze odmiany i testów** (`app/components/StrainForm.js`, `OptionSelect.js`, `TerpenePicker.js`, `Tests.js`, `app/import/ImportForm.js`, `app/change-password/ChangePasswordForm.js`)
- Formularz odmiany: sekcje z `.section-label` („Podstawowe”, „Skład”, „Partia”, „Opis”), pola liczbowe obok siebie (THC, CBD).
- Przycisk „Zapisz” w `.mobile-form-bar` po prawej (dziś jest tylko „Zamknij”). Zmiana hasła jako ekran ustawień.
- Testy: formularz dodawania zwinięty pod przyciskiem „Dodaj test”.

**I. Ekrany systemowe** (`app/error.js`, `app/not-found.js`, `app/loading.js`, `app/strains/[id]/loading.js`, `app/components/Skeleton.js`, `app/compare/page.js`)
- Błąd i 404 jako `.empty` z ikoną `alert` i akcją powrotu. Szkielety w kształcie nowej karty (tytuł, linia meta, liczba po prawej).
- Porównanie: na telefonie kolumny jako karty przewijane w poziomie.
