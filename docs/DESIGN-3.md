# Design 3: więcej koloru i wyraźna hierarchia

Odpowiedź na uwagi pierwszych testerów bety: aplikacja jest za mało kolorowa i przytłaczająca, nic się nie wyróżnia, wszystko zlewa się w całość, przez co trudno się w niej odnaleźć i nie chce się z niej korzystać. Ten dokument zawiera diagnozę obecnego wyglądu (wersja 0.53.0), dwa kierunki z makietami, rekomendację, nowe zasady i plan wdrożenia na agentów. **Decyzja 9.10: kierunek B z elementami A (sekcja 0).** Zasady z sekcji 0 i 6 zastąpiły „jeden akcent” i „hierarchię zamiast ozdobników” w `docs/DESIGN.md`.

Makiety są w `docs/design3/`: pliki HTML (samodzielne, inline CSS, fonty z `docs/design3/fonts/`) i PNG (390 px, dpr 2, pełna strona).

| Ekran | Kierunek A „Ciepła apteka” | Kierunek B „Dashboard zdrowia” |
|---|---|---|
| Dziś | `a-dzis.png` | `b-dzis.png` |
| Dziś, ciemny | `a-dzis-ciemny.png` | `b-dzis-ciemny.png` |
| Lista odmian | `a-odmiany.png` | `b-odmiany.png` |
| Szczegóły odmiany | `a-odmiana.png` | `b-odmiana.png` |
| Dziennik objawów | `a-dziennik.png` | `b-dziennik.png` |
| Tryb dyskretny | `a-dzis-dyskretny.png`, `a-odmiany-dyskretny.png` | (te same reguły) |
| Porównanie obecny, A, B | `porownanie.png` (Dziś, jasny), `porownanie-ciemny.png`, `porownanie-odmiany.png` | |

## 0. Decyzja (9.10): kierunek B z elementami A

Właściciel wybrał po konsultacji z testerem **kierunek B „Dashboard zdrowia”**. Najbardziej podobała się strona główna B. Bierzemy z niej:
- nowy dolny pasek Dziś / Odmiany / „+” / Dziennik / Więcej (Katalog i Rankingi jako przełącznik na ekranie Odmian, Szukaj i Znajomi w „Więcej”);
- osobny ekran `/odmiany` (strona główna to tylko panel „Dziś”).

Sekcje 4 (rekomendacja A) i 7 (plan pod A) zostają jako historia; obowiązuje ta sekcja.

### Co bierzemy z A i dlaczego

Testerzy pisali jednocześnie „za mało koloru” i „przytłaczająca”. B daje kolor i punkt skupienia, a elementy A pilnują, żeby kolor nie zaczął przytłaczać. Bierzemy cztery rzeczy:
1. **Kolory obszarów** z sześcioma rolami (zapas i zużycie, dziennik i objawy, recepty, odmiany, społeczność, wiedza i raport) i trójką odcieni na obszar: wypełnienie, tło tonalne, tusz. Kolor mówi, gdzie się jest.
2. **Tła tonalne sekcji na ekranach drugiego poziomu** (dziennik, recepty, historia, szczegóły odmiany) zamiast pełnych kafli. Sekcja z tematem dostaje `--cat-*-soft`, ikony i podpisy `--cat-*-ink`.
3. **Szybkie kafle z ikonami w kolorowych kółkach** (`.tile` + `.ic-dot`) na Dziś i w arkuszu „Więcej”.
4. **Mniej pełnych kafli niż w makiecie B.** Pełne kolory (`.kpi-tile.solid`, `.ic-dot.solid`) są tylko na ekranie Dziś: w hero i w najwyżej dwóch kaflach KPI naraz (np. recepta i nastrój). Na pozostałych ekranach jedyną pełną plamą koloru jest hero albo przycisk główny.

Typografia jest z B: **jeden krój, Figtree.** Tytuły mają 700, `h1` i duże liczby 800, cyfry tabelaryczne. Fraunces wypada. `--font-display` wskazuje na Figtree, więc wszystkie dawne użycia zmieniają się same. To też o jeden plik fontu mniej na starcie (Lighthouse).

### Finalne tokeny (w `app/globals.css`, wszystkie trzy bloki)

Paleta wykresów (`--chart-*`, `--seq-*`) i rodzaje odmian (`--kind-*`) są bez zmian. `--bar` też zostaje bez zmian, więc pasek stanu, `themeColor` i Capacitor się nie zmieniają: hero zaczyna gradient od `var(--bar)`.

```css
/* jasny (:root) */
--bg: #edf1f4; --surface: #ffffff; --surface-2: #f2f5f7; --surface-3: #e5ebef; --field-bg: #ffffff;
--sep: #e0e6ea; --sep-strong: #c3cdd4; --card-line: rgba(15, 30, 40, .05);
--text: #0f1b1f; --text-2: #475760; --text-3: #5b6b73;
--accent: #0f6b52; --accent-hover: #0b5a45; --on-accent: #ffffff; --accent-text: #0f6b52; --accent-soft: #d9f0e7; --on-accent-soft: #0a4a39;
--btn: #0f6b52; --btn-hover: #0b5a45; --on-btn: #ffffff;
--bar: #1d3b27; --hero-2: #0f6450; --hero-3: #0e7563; --on-hero: #ffffff; --on-hero-2: #d3ece3; --hero-btn-2: rgba(0, 0, 0, .18);
--on-cat: #ffffff;
--cat-stock: #0f7a55;   --cat-stock-soft: #dcf3ea;   --cat-stock-ink: #0a5a3f;
--cat-journal: #6a32d1; --cat-journal-soft: #ede5fd; --cat-journal-ink: #4f22a3;
--cat-rx: #1f56d6;      --cat-rx-soft: #e2eaff;      --cat-rx-ink: #1a43a6;
--cat-strain: #0b6f82;  --cat-strain-soft: #d8f0f5;  --cat-strain-ink: #08525f;
--cat-social: #c0266b;  --cat-social-soft: #fde2ee;  --cat-social-ink: #931a50;
--cat-learn: #8f5a00;   --cat-learn-soft: #fbedd2;   --cat-learn-ink: #6b4300;
--warn: #b43c0a; --warn-soft: #ffe9dc; --warn-line: #f5c8ad; --ok: #0f7a55; --ok-soft: #dcf3ea;
--shadow-card: 0 1px 3px rgba(15, 30, 40, .07), 0 6px 20px rgba(15, 30, 40, .06);

/* ciemny (:root[data-theme="dark"] i @media prefers-color-scheme: dark, identyczne) */
--bg: #0b1114; --surface: #141c20; --surface-2: #1b252a; --surface-3: #243037; --field-bg: #10181c;
--sep: #223038; --sep-strong: #36464f; --card-line: rgba(255, 255, 255, .05);
--text: #e8eef1; --text-2: #a4b2b9; --text-3: #87969d;
--accent: #4fd1a5; --accent-hover: #6fdcb7; --on-accent: #05231a; --accent-text: #6fdcb7; --accent-soft: #12322a; --on-accent-soft: #a6ecd3;
--btn: #0f7a5c; --btn-hover: #12896a; --on-btn: #ffffff;   /* przycisk główny nie świeci na miętowo */
--bar: #1d3b27; --hero-2: #0f4a3c; --hero-3: #0d5a4d; --on-hero: #ffffff; --on-hero-2: #c4e3d8; --hero-btn-2: rgba(0, 0, 0, .22);
--on-cat: #ffffff;
--cat-stock: #11694c;   --cat-stock-soft: #123128;   --cat-stock-ink: #5fd6a8;
--cat-journal: #5530a3; --cat-journal-soft: #251a3f; --cat-journal-ink: #b9a0ff;
--cat-rx: #2449a6;      --cat-rx-soft: #16233f;      --cat-rx-ink: #93b4ff;
--cat-strain: #0d5f6f;  --cat-strain-soft: #0f2c33;  --cat-strain-ink: #62cde0;
--cat-social: #9e2459;  --cat-social-soft: #36172a;  --cat-social-ink: #ff93c2;
--cat-learn: #7a4e05;   --cat-learn-soft: #33260c;   --cat-learn-ink: #f2bd63;
--warn: #ffa66b; --warn-soft: #38200f; --warn-line: #5c3517; --ok: #5fd6a8; --ok-soft: #123128;
--shadow-card: 0 1px 2px rgba(0, 0, 0, .4), 0 6px 20px rgba(0, 0, 0, .3);

/* bez kolorów, tylko w :root */
--r-md: 12px; --r-lg: 18px; --r-xl: 24px; --font-display: var(--font-body);
```

Znaczenie ról:
- `--cat-x` to **wypełnienie** z tekstem `--on-cat` (pełny kafel, kółko `.solid`).
- `--cat-x-soft` to tło tonalne.
- `--cat-x-ink` to tekst i ikona na tle tonalnym i na powierzchni.

Ikona na `--cat-x-soft` jest zawsze w `--cat-x-ink`, nigdy w `--cat-x`: w ciemnym motywie `--cat-x` na `--cat-x-soft` daje tylko 2,3–2,8:1.

### Kontrast finalnych tokenów

Wynik `node docs/design3/kontrast-final.mjs`. Wszystkie 100 par (po 50 w każdym motywie, w tym 30 par obszarów) pilnuje test `kontrast par tekst/tło` w `tests/theme.test.js`. Pliki `docs/design3/tokens.mjs` i `kontrast.mjs` dotyczą makiet i są nieaktualne.

| Para | Jasny | Ciemny |
|---|---|---|
| tekst główny na tle | 15,45 | 16,23 |
| `--text-3` na tle (najsłabszy tekst) | 4,87 | 6,23 |
| `--text-2` na `--surface-2` | 6,85 | 7,17 |
| `--on-btn` na `--btn` (przycisk główny) | 6,47 | 5,30 |
| `--accent-text` na tle (linki) | 5,70 | 11,41 |
| `--accent` na tle (fokus, 3:1) | 5,70 | 9,96 |
| `--on-hero-2` na `--hero-3` (podpisy w hero) | 4,51 | 5,92 |
| biały na przycisku drugorzędnym hero (`--hero-btn-2` na `--hero-3`) | 7,48 | 10,75 |
| min. `--cat-*-ink` na `--cat-*-soft` | 6,90 | 7,34 |
| min. `--text-2` na `--cat-*-soft` | 6,15 | 6,45 |
| min. `--cat-*-ink` na `--surface` | 8,24 | 7,84 |
| min. `--on-cat` na `--cat-*` (pełny kafel) | 5,34 | 6,67 |
| `--warn` na `--warn-soft` | 5,00 | 7,90 |
| `--danger` na `--danger-soft` | 5,20 | 7,75 |

Na hero nie używamy półprzezroczystej bieli (`rgba(255,255,255,.14)` na `--hero-3` daje 4,27:1). Przyciski drugorzędne są przyciemnione: `--hero-btn-2`.

### Etap 0: zrobione (gałąź etapu 0)

**Komponenty bazowe w `app/globals.css`, do użycia w S1–S3 bez zmian w `globals.css`:**
- `data-cat="stock|journal|rx|strain|social|learn"` na dowolnym elemencie ustawia `--c`, `--c-soft` i `--c-ink` dla niego i jego dzieci.
- `.ic-dot` (kółko 44 px; `.sm` 36 px; `.sq` jako zaokrąglony kwadrat; `.solid` w pełnym kolorze).
- `.sec-head` (kółko, `h2`, akcja).
- `.card.tint` (karta tonalna).
- `.tiles` i `.tile` (szybkie kafle).
- `.kpi-tile` z `.kt-label`, `.kt-value`, `.kt-sub` (wariant `.solid` oszczędnie).
- `.big-num`.
- `.hero` (gradient od `--bar`; na telefonie pełna szerokość pod górnym paskiem; `.hero .btn` jest biały, `.hero .btn.ghost` przyciemniony).
- `.page-head`.
- `.btn.soft` (tło obszaru).
- `.seg` także z linkami (`.seg a.on`).
- `[data-cat] .chip.on`.

**Zmiany w istniejących klasach:**
- `.card` i `.list` mają cień `--shadow-card` i promień 18; karta w karcie jest bez cienia.
- `.btn` używa `--btn` i grubości 700.
- `h1`–`h3` mają Figtree 700/800.

**Nawigacja:**
- `navItems.js`: pole `cat`, `short`, `file`; grupy arkusza Dziennik, Odkrywaj, Społeczność, Konto; Eksport i Import CSV są w „Konto”.
- Dolny pasek: Dziś, Odmiany, „+” (klasa `.fab` w środku paska, menu dodawania), Dziennik, Więcej. Na „Więcej” jest plakietka zaproszeń (`NavBadge kind="social"`).
- Aktywna zakładka ma kolor swojego obszaru.
- Arkusz „Więcej” ma ikony w kółkach w kolorach obszarów.
- Desktop: górny pasek Dziś, Odmiany, Dziennik objawów, Recepty, Katalog, Szukaj, Znajomi.

**Trasy:**
- `/` to tylko panel „Dziś” z hero. Stare adresy `/?new=1` i `/?q=` przekierowują na `/odmiany`.
- `/odmiany` to lista (`StrainsBoard` w `HomeStore` bez danych panelu) z przełącznikiem Moje / Katalog / Rankingi i ikoną wyszukiwania. `app/odmiany/WidgetSync.js` odświeża widżet Androida po „Zużyłem” i „Wykupiłem” na karcie, bo panelu „Dziś” na tej stronie nie ma.
- Linki „Wszystkie odmiany” i „Przejdź do odmian” prowadzą na `/odmiany`.
- Skrót manifestu „Nowa odmiana” to `/odmiany?new=1`.
- Skróty APK (`SHORTCUT_PATHS`: `/?zuzylem=1`, `/#objawy`, `/raport`) bez zmian: wskazują panel „Dziś”, więc APK nie trzeba przebudowywać.

### Etap 1 pod B: trzy równoległe strumienie

Wspólne zasady dla S1–S3:
- Nie zmieniaj `app/globals.css`, `app/styles/nav.css`, `navItems.js`, `BottomNav.js`, `Header.js` ani `tests/e2e/zielnik.test.mjs`. Brakujący komponent bazowy opisz w raporcie.
- Zachowaj klasy z listy ryzyk (sekcja 7) i `.dn` przy nazwach odmian.
- Kolory tylko przez tokeny, cele 44 px.
- Pełne kolory obszaru tylko tam, gdzie mówi zlecenie.

**S1: panel „Dziś”** (makieta `docs/design3/b-dzis.png`)
- Pliki:
  - `app/page.js` (tylko wnętrze hero)
  - `app/components/TodayBoard.js`, `TodayPanel.js`, `QuickActions.js`, `SymptomsQuick.js`, `NoUseToday.js`, `Onboarding.js`, `WhatsNew.js`
  - `app/components/charts/StockForecast.js`, `UsageDays.js` (tylko opakowanie)
  - `app/styles/home.css`, `app/styles/system.css`
- Zakres:
  - Hero z zapasem: liczba `.big-num` biała, pierścień dni zapasu (inline SVG), „Zużyłem” jako `.hero .btn`, „Wykupiłem” jako `.hero .btn.ghost`.
  - Pod hero siatka 2×2 `.kpi-tile`: recepta (`.solid`, `data-cat="rx"`), nastrój z dziennika (`.solid`, `data-cat="journal"`), dziś zużyto i „Kończy się” (`--warn`, tylko gdy jest powód).
  - Karta wykresu 14 dni z `.sec-head`.
  - Lista „Do zrobienia” z `.ic-dot.sq`.
  - Zachowaj: `.today`, `.today-quick`, `.tq-stock`, `.quick-btn`, `.use-chip`, `.quick-msg`, `.undo-btn`, `.usage-sel`, `.usage-scrub`, `details.stock-notes`, `.fc-note`, `#objawy`, `.no-use`, `.kpi-big`, `.trx`, `.home-date`, `section.empty` z jednym przyciskiem „Dodaj odmianę”.

**S2: odmiany** (makiety `b-odmiany.png`, `b-odmiana.png`)
- Pliki:
  - `app/odmiany/*`
  - `app/components/StrainsBoard.js`, `StrainCard.js`, `StrainDetail.js`, `CharacteristicCard.js`, `Effects.js`, `StrainHistory.js`, `StrainProposals.js`, `Tests.js`, `StrainForm.js`
  - `app/strains/[id]/*`, `app/katalog/*`, `app/compare/page.js`, `app/rankings/*`, `app/wheel/*`
  - `app/styles/strains.css`, `detail.css`, `catalog.css`, `rankings.css`, `proposals.css`, `forms.css`
- Lista:
  - nad listą trzy liczby (odmiany, w domu, średnia ocena);
  - wiersze w jednej karcie: kwadrat w kolorze rodzaju z ikoną `jar`/`drop` (nie inicjały, bo zdradzałyby nazwę);
  - ocena 800 po prawej;
  - pigułka stanu (`.btn.soft` „Zużyłem” w `data-cat="stock"`).
- „Porównaj” i „Edytuj” przenieść do szczegółów albo do menu karty.
- Szczegóły:
  - hero z nazwą (`.dn`) i chipami;
  - trzy kafle ocen (jeden `.solid` dla „Moja”);
  - karty z `.sec-head` i `.ic-dot` w kolorach obszarów;
  - zamiast pustego prostokąta zdjęcia ilustracja słoika.
- Katalog i rankingi z tym samym przełącznikiem `.seg-links` co `/odmiany`.
- Zachowaj: `.quick`, `.quick-stock`, przyciski „Wykupiłem: <nazwa>”, `a[href^="/strains/"]`, `.proposal-box`, `.proposal-item`, `details.terp`, `.dn`, „Edytuj odmianę”.

**S3: dziennik, historia, recepty, raport, profil, obserwacje** (makieta `b-dziennik.png`)
- Pliki:
  - `app/dziennik/*`, `app/historia/*`, `app/recepty/*`, `app/raport/*`, `app/profil/*`, `app/obserwacje/*`
  - `app/components/RxPicker.js`, `PharmacyLink.js`
  - `app/components/charts/SymptomsChart.js`, `UsageWeeks.js`, `WeeklyBars.js`, `PeriodCompare.js` (opakowanie)
  - `app/styles/diary.css`, `history.css`, `profile.css`, `charts.css` (jedyny właściciel), `content.css`, `screens.css`
- Każdy ekran ma kartę tonalną albo hero w kolorze obszaru (`.card.tint` / `.hero` z `data-cat`; pełny kolor tylko w hero):
  - dziennik: fioletowy (`journal`)
  - recepty: niebieski (`rx`)
  - historia: zielony (`stock`)
  - raport: ochra (`learn`)
  - profil: neutralny z `.ic-dot` przy sekcjach
- Dziennik:
  - wpis z dziś w karcie tonalnej;
  - małe wykresy w wierszach z trendem w pigułce;
  - notka o prywatności neutralna (`--surface-2`), nie `.alert.note`.
- Wykresy biorą kolory tylko z `--chart-*`, a seria leży zawsze na `--surface`.
- Zachowaj: `.sym-custom`, `svg.sym-chart`, `.pharmacy`, `.pharmacy-rx`, `.pharmacy-pool`, `.doctor-notes`, `.dn-list`, `.report-notes`, `.report-sheet`, `.lock-setup`, `section[aria-labelledby=remind-h]`, `#remind-*`, `.fb-row`, `.trx`, `.badge`.

### Etap 2: QA
- `npm run test:e2e` (axe w obu motywach, 44 px, druk, 320/1280 px).
- `scripts/dev/shots.mjs` 390 jasny/ciemny + `--discreet` dla `/`, `/odmiany`, `/strains/1`, `/dziennik`, `/historia`, `/recepty`, `/raport`, `/profil` i arkusza „Więcej”.
- Ręcznie na telefonie: pasek stanu (bez zmian, kolor `--bar`), duży tekst, wydruk raportu.
- Lighthouse `/` i `/login` w budżecie.
- Po etapie 1 usunąć nieużywane style (`.home-section`, stare `.fab` w `platform.css`) i zaktualizować `docs/DESIGN.md` o komponenty ekranów.

## 1. Diagnoza: skąd bierze się „szarość”

Zrzuty 390 px obecnej wersji, jasny i ciemny motyw: `/`, `/strains/1`, lista odmian, `/dziennik`, `/historia`, `/recepty`, `/profil` i arkusz „Więcej”.

1. **Karty nie odcinają się od tła.** Biała karta `#fff` leży na tle `#f4f5f1`, a kontrast między nimi wynosi około 1,07:1. Oddziela je tylko linia 1 px (`--sep`). Wszystkie bloki mają tę samą wagę, więc oko nie wie, od czego zacząć.
2. **Jeden kolor robi wszystko.** Ta sama zieleń oznacza przycisk, aktywną zakładkę, każdy słupek wykresu, linki rozwijane („Prognoza i wykupy”, „Szczegóły i ustawienia”), pasek recepty i znacznik zapasu. Akcent przestaje cokolwiek wyróżniać. Najbardziej kolorowym elementem `/dziennik` jest beżowa notka ostrzegawcza z informacją o prywatności.
3. **Panel „Dziś” to jedna długa karta.** Pięć sekcji rozdzielonych liniami: zapas, prognoza, ostatnio używana, wykres i ustawienia. Nie ma jednego punktu skupienia. Najważniejsza liczba (8,5 g) ma tę samą ramę co dwa zwinięte wiersze.
4. **Etykiety sekcji są jednakowe.** Wszystkie mają 14 px w `--text-2` („Mój dziennik”, „Ostatnie 30 dni”, „Twój miesiąc”), więc nie da się szybko przeskanować ekranu. W arkuszu „Więcej” stoi 12 identycznych szarych ikon liniowych, a obszary aplikacji (dziennik, odkrywaj, konto) wyglądają tak samo.
5. **Lista odmian przypomina formularz.** Każda karta ma tę samą stopkę z trzema kontrolkami: „Szczegóły”, pole wyboru „Porównaj” i „Edytuj”. Na ekran mieszczą się półtorej odmiany. Ocena (duża liczba) konkuruje z nazwą.
6. **Szczegóły odmiany zaczynają się od pustego miejsca.** Szary prostokąt zdjęcia zajmuje 300 px, a gdy zdjęcie się nie wczyta, widać tylko alt. Potem pasek trzech ocen z liniami i dopiero niżej treść.
7. **Przycisk „+” zasłania treść** na każdym ekranie, także tam, gdzie dodawanie nie ma sensu.
8. **Ciemny motyw:** miętowy przycisk i miętowy „+” są najjaśniejszymi elementami ekranu i przyciągają wzrok mocniej niż dane.
9. **Nawigacja i tytuł nie zgadzają się.** Ekran nazywa się „Dziś”, a aktywna jest zakładka „Odmiany”. Dziennik, historia i recepty są ukryte w arkuszu „Więcej”, choć to najczęstsze czynności po zapisaniu zużycia.
10. **Liczby nie mają skali.** 8,5 g, 0,3 g, oceny 8,5/7,8/8,0 i liczba dni recepty mają podobny rozmiar i krój. Nie widać, która liczba jest stanem, a która szczegółem.

Wniosek: problemem nie jest brak ozdób, tylko brak warstw. Potrzebne są tła tonalne (sekcja ma kolor), kolor przypisany do obszaru (żeby było wiadomo, gdzie się jest), jedna wyraźna liczba na ekran i karty, które odcinają się od tła.

## 2. Kierunek A: „Ciepła apteka”

Spokojny, ciepły i kolorowy przez tła, a nie przez nasycenie. Kremowe tło, białe karty z miękkim cieniem i karty sekcji w pastelowych odcieniach kategorii. Ikony stoją w kolorowych kółkach. Fraunces zostaje dla tytułów i dużych liczb, więc całość wygląda jak elegancki dziennik zdrowia.

- **Paleta.** Marka to butelkowa zieleń `#2b6a4a`. Sześć kategorii:
  - zapas i zużycie: zieleń
  - dziennik i objawy: fiolet
  - recepty: niebieski
  - odmiany: morski
  - społeczność: malinowy
  - wiedza i raport: ochra

  Każda kategoria ma trzy odcienie: `--cat-x` (ikona, wypełnienie), `--cat-x-soft` (tło sekcji) i `--cat-x-ink` (tekst na tle). Tło strony jest kremowe `#f6f3ec`, a karty są białe z cieniem `--shadow-card`.
- **Typografia.** Fraunces 30 dla `h1`, 19 dla tytułów kart i 56 dla liczby-bohatera (zapas). Figtree dla reszty. Jedna liczba-bohater na ekran.
- **Karty.** Promień 22 px, bez ramki, z miękkim cieniem. Sekcja z tematem (zapas, objawy dnia, notatka) dostaje tło `--cat-x-soft` bez cienia. Wnętrze tonalnej karty to białe „wyspy”, na przykład wiersz oleju czy pola objawów.
- **Ikony.** W kółkach 36–44 px: `--cat-x-soft` z ikoną `--cat-x` na białej karcie albo pełne `--cat-x` z ikoną `--surface` na karcie tonalnej. Szybkie kafle na Dziś: Objawy, Recepty, Odmiany, Raport.
- **Nawigacja.** Dolny pasek: Dziś, Odmiany, „+” (środek, nie zasłania treści), Dziennik, Więcej. Aktywna zakładka ma pigułkę w kolorze kategorii, na przykład fioletową dla Dziennika. Górny pasek jest jasny, w kolorze tła.
- **Przyciski.** Główny ma 48 px, promień 14 i kolor `--btn`. Drugorzędny jest biały z ramką. „Zużyłem” na liście odmian to miękki przycisk w odcieniu zapasu.
- **Chipy.** Pigułki 44 px (cel dotykowy). Wybrany chip ma pełny kolor kategorii ekranu. Znaczniki danych (THC, CBD, cena) mają tło `--surface-2`.
- **Puste stany i mikroilustracje.** Proste SVG z kształtów: słoik, linia trendu w ramce, koła. Kolor kategorii na tle `--cat-x-soft`. Bez liści i bez postaci.
- **Ciemny motyw.** Tła tonalne to ciemne odcienie kategorii (`#1b3124`, `#272240`...), a ikony i teksty kategorii są jasne. Przycisk główny dostaje osobny token `--btn` `#2f7a4e` z białym tekstem, więc przestaje świecić na miętowo.

Pięć zdań: A dodaje koloru tłami sekcji, a nie krzykliwymi wypełnieniami, więc aplikacja jest wyraźnie bardziej żywa, ale nadal spokojna. Każdy obszar ma swój kolor (zapas zielony, objawy fioletowe, recepty niebieskie), co od razu mówi, gdzie się jest i co jest czym. Ekran Dziś ma jeden punkt skupienia (8,5 g na zielonym tle) i szybkie kafle z kolorowymi ikonami zamiast pięciu sekcji w jednej karcie. Fraunces i kremowe tło dają ton apteki albo dobrego dziennika zdrowia, wiarygodny dla dorosłych pacjentów. Zmiana mieści się w obecnej strukturze komponentów (karta, karta tonalna, kółko z ikoną), a jej koszt to jasny górny pasek sprzężony z paskiem stanu Androida.

## 3. Kierunek B: „Nowoczesny dashboard zdrowia”

Mocniejszy, chłodniejszy i bardziej „produktowy”. Na Dziś i w szczegółach odmiany jest pełnoszerokościowy nagłówek z gradientem marki, który zaczyna się kolorem obecnego paska `#1d3b27`, więc pasek stanu się nie zmienia. Pod nim stoją kontrastowe kafle KPI w pełnych kolorach kategorii z białym tekstem. Typografia jest bezszeryfowa (Figtree 700–800) z dużymi, ciężkimi liczbami.

- **Paleta.** Marka to szmaragd `#0f6b52`. Hero to gradient `--hero-1 → --hero-3`. Kategorie mają te same obszary co w A, ale są bardziej nasycone, bo służą jako wypełnienia z białym tekstem:
  - stock `#0f7a55`
  - journal `#6a32d1`
  - rx `#1f56d6`
  - strain `#0b6f82`
  - social `#c0266b`
  - learn `#8f5a00`

  Tło jest chłodne `#edf1f4`.
- **Typografia.** Figtree 800 dla liczb (52 w hero, 32 w kaflach), 700 dla tytułów (26/18). Fraunces wypada z interfejsu.
- **Karty.** Promień 20, wyraźniejszy cień. Kafle KPI (2×2) nachodzą na hero o 46 px. Dwa z nich są pełne (recepta, nastrój), a dwa białe z kolorową ikoną (dziś, „Kończy się” w kolorze ostrzeżenia).
- **Ikony.** W zaokrąglonych kwadratach 40 px (`--cat-x-soft` z tuszem kategorii), a w hero półprzezroczyste białe. Pierścień zapasu (dni względem 30) w hero.
- **Nawigacja.** Biały dolny pasek, okrągły „+” z gradientem w środku i aktywna zakładka z belką u góry w kolorze kategorii. Inne ekrany mają zwykły ciemny pasek i kolorową kartę-hero sekcji, na przykład fioletową w Dzienniku.
- **Przyciski i chipy.** Biały przycisk główny w hero, poza hero przycisk `--btn`. Przełączniki segmentowe na pełną szerokość („Moje / Katalog / Rankingi”). Stan zapasu jako pigułka (zielona „Mam 6,5 g”, pomarańczowa „Mam 2 g, kończy się”).
- **Lista odmian.** Jedna karta z wierszami. Kwadrat 48 px w kolorze rodzaju z inicjałami (w trybie dyskretnym rozmyty, `.dn`), ocena tłustą liczbą po prawej. Nad listą trzy liczby: odmiany, w domu, średnia ocena.
- **Ciemny motyw.** Wypełnienia kategorii są przyciemnione (`#2449a6`, `#5530a3`...), żeby nie świeciły. Hero jest ciemniejszym gradientem, a tusze kategorii jasne.

Pięć zdań: B najmocniej odpowiada na „nic nie przyciąga uwagi”, bo hero z gradientem i pełne kafle KPI od razu pokazują stan zapasu, receptę i samopoczucie. Ekran wygląda jak nowoczesna aplikacja zdrowotna (Apple Health, aplikacje banków) i jest bardzo czytelny w skanowaniu. Gradient zaczyna się kolorem obecnego paska, więc nie trzeba zmieniać paska stanu ani konfiguracji Capacitora. Ryzykiem jest ciężar wizualny: przy wielu pełnych kaflach ekran może znów stać się „przytłaczający”, tym razem kolorem, a ton zbliża się do fintechu bardziej niż do apteki. Wdrożenie jest droższe, bo hero nachodzące na kafle, pierścień i nowa typografia liczb to nowe komponenty, a zmiana kroju (bez Fraunces) dotyka wszystkich ekranów.

## 4. Rekomendacja (przed decyzją; nieaktualna, patrz sekcja 0)

**Kierunek A z trzema elementami z B:**
1. Lista „Do zrobienia” na Dziś (wykup z recepty, objawy dnia, raport) jako karta z kolorowymi ikonami.
2. Ostrzeżenie o kończącej się odmianie jako osobny kafel w kolorze `--warn` (tylko gdy jest powód).
3. Przełącznik „Moje / Katalog / Rankingi” na ekranie Odmian.

Uzasadnienie:
- Testerzy zgłaszają jednocześnie „za mało koloru” i „przytłaczająca”. A dodaje kolor tłami i ikonami, a nie wielkimi nasyconymi plamami, więc rozwiązuje oba problemy naraz. B rozwiązuje pierwszy kosztem ryzyka drugiego.
- Ton: dorośli pacjenci i dane o zdrowiu. Kremowe tło, Fraunces i pastelowe sekcje są bliższe aptece i dziennikowi niż fintechowi. Wiarygodność ma większą wagę niż efekt „wow”.
- Koszt: A korzysta z obecnych komponentów (karta, `.list`, `.section-label`, ikony) i dodaje dwa warianty: kartę tonalną i kółko ikony. Krój pisma się nie zmienia. Poza CSS zmieniają się: jasny górny pasek (sprzężony z paskiem stanu, patrz ryzyka), nowy układ dolnego paska z „+” (`navItems.js`, `BottomNav.js`) i ewentualnie trasa listy odmian. Ten sam układ nawigacji dotyczy też B.
- Ciemny motyw A (ciemne tła tonalne i osobny `--btn`) jest spokojniejszy niż obecny i niż B.

Jeśli właściciel woli mocniejszy efekt, B jest gotowy i również przechodzi kontrast. Można też wziąć z B tylko hero na ekranie Dziś (gradient od `--bar`), a resztę z A.

## 5. Tokeny

Nowe tokeny dochodzą do `app/globals.css` obok istniejących. Stare nazwy zostają jako aliasy: `--accent: var(--brand)`, `--accent-soft: var(--brand-soft)`, `--on-accent: var(--on-btn)` (dla przycisku). Dzięki temu ekrany przechodzą na nowy wygląd stopniowo. **Nie zmieniaj** `--chart-*`, `--seq-*`, `--chart-data`, `--chart-ref` ani `--kind-*`: paleta wykresów jest walidowana i przypięta w `tests/theme.test.js`. Kolory kategorii to osobne tokeny `--cat-*`. Oba bloki ciemnego motywu (`:root[data-theme="dark"]` i `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`) muszą być identyczne, a każdy kolor jasny musi mieć wartość ciemną.

### Kierunek A, jasny
```css
:root {
  --bg: #f6f3ec; --bg-tint: #efe9dd; --surface: #ffffff; --surface-2: #f3efe6; --surface-3: #e9e3d6;
  --sep: #e8e2d6; --sep-strong: #cdc5b6;
  --text: #1c2420; --text-2: #525a54; --text-3: #676e68;
  --brand: #2b6a4a; --brand-hover: #225a3e; --on-brand: #ffffff; --btn: #2b6a4a; --on-btn: #ffffff;
  --brand-soft: #dcefe2; --on-brand-soft: #1c4a32;
  --bar: #f6f3ec; --on-bar: #1c2420;
  --cat-stock: #2b7a4c;   --cat-stock-soft: #e1f2e6;   --cat-stock-ink: #1d5535;
  --cat-journal: #6a4fb6; --cat-journal-soft: #eee9fb; --cat-journal-ink: #4a3590;
  --cat-rx: #2c62b5;      --cat-rx-soft: #e3ecfa;      --cat-rx-ink: #1f4888;
  --cat-strain: #0d726d;  --cat-strain-soft: #d9f1ee;  --cat-strain-ink: #0a5450;
  --cat-social: #b03b67;  --cat-social-soft: #fbe6ee;  --cat-social-ink: #85284c;
  --cat-learn: #8a6200;   --cat-learn-soft: #f8eed3;   --cat-learn-ink: #654700;
  --warn: #a54a00; --warn-soft: #fdecd9; --danger: #b42318; --danger-soft: #fde8e6; --ok: #2b7a4c; --ok-soft: #e1f2e6;
  --shadow-card: 0 1px 2px rgba(60, 48, 24, .05), 0 6px 20px rgba(60, 48, 24, .07);
  --r-card: 22px; --r-tile: 18px;
}
```

### Kierunek A, ciemny (ten sam blok w obu miejscach)
```css
:root[data-theme="dark"] {
  --bg: #121613; --bg-tint: #171c18; --surface: #1c211e; --surface-2: #242b26; --surface-3: #2d3530;
  --sep: #2c342e; --sep-strong: #424c45;
  --text: #ecebe4; --text-2: #adb5ad; --text-3: #929a92;
  --brand: #8bd1a3; --brand-hover: #a2dcb5; --on-brand: #0d1d13; --btn: #2f7a4e; --on-btn: #ffffff;
  --brand-soft: #1f3628; --on-brand-soft: #bfe8cc;
  --bar: #121613; --on-bar: #ecebe4;
  --cat-stock: #8bd1a3;   --cat-stock-soft: #1b3124;   --cat-stock-ink: #a9e0bb;
  --cat-journal: #b9a6f2; --cat-journal-soft: #272240; --cat-journal-ink: #cfc1f7;
  --cat-rx: #92b8f5;      --cat-rx-soft: #1b2840;      --cat-rx-ink: #b5cff8;
  --cat-strain: #6fd3cb;  --cat-strain-soft: #123331;  --cat-strain-ink: #9be2dc;
  --cat-social: #f29bbb;  --cat-social-soft: #371e29;  --cat-social-ink: #f6bcd1;
  --cat-learn: #e6c46b;   --cat-learn-soft: #30280f;   --cat-learn-ink: #efd698;
  --warn: #f3b469; --warn-soft: #33240f; --danger: #f4a197; --danger-soft: #3a1d19; --ok: #8bd1a3; --ok-soft: #1b3124;
  --shadow-card: 0 1px 2px rgba(0, 0, 0, .35), 0 6px 20px rgba(0, 0, 0, .25);
}
```
W A `--cat-x` służy jako kolor ikony i wypełnienie kółka. W ciemnym motywie pełne kółko ma ikonę w `--surface` (ciemna ikona na jasnym kole).

### Kierunek B, jasny
```css
:root {
  --bg: #edf1f4; --bg-tint: #e4eaee; --surface: #ffffff; --surface-2: #f2f5f7; --surface-3: #e5ebef;
  --sep: #e0e6ea; --sep-strong: #c3cdd4;
  --text: #0f1b1f; --text-2: #475760; --text-3: #5b6b73;
  --brand: #0f6b52; --brand-hover: #0b5a45; --on-brand: #ffffff; --btn: #0f6b52; --on-btn: #ffffff;
  --brand-soft: #d9f0e7; --on-brand-soft: #0a4a39;
  --bar: #1d3b27; --on-bar: #eef1e8;
  --hero-1: #1d3b27; --hero-2: #0f6450; --hero-3: #0e7563; --on-hero: #ffffff; --on-hero-2: #d3ece3;
  --cat-stock: #0f7a55;   --cat-stock-soft: #dcf3ea;   --cat-stock-ink: #0a5a3f;
  --cat-journal: #6a32d1; --cat-journal-soft: #ede5fd; --cat-journal-ink: #4f22a3;
  --cat-rx: #1f56d6;      --cat-rx-soft: #e2eaff;      --cat-rx-ink: #1a43a6;
  --cat-strain: #0b6f82;  --cat-strain-soft: #d8f0f5;  --cat-strain-ink: #08525f;
  --cat-social: #c0266b;  --cat-social-soft: #fde2ee;  --cat-social-ink: #931a50;
  --cat-learn: #8f5a00;   --cat-learn-soft: #fbedd2;   --cat-learn-ink: #6b4300;
  --warn: #b43c0a; --warn-soft: #ffe9dc; --danger: #c81e1e; --danger-soft: #fde6e6; --ok: #0f7a55; --ok-soft: #dcf3ea;
  --shadow-card: 0 1px 3px rgba(15, 30, 40, .08), 0 8px 24px rgba(15, 30, 40, .08);
}
```

### Kierunek B, ciemny
```css
:root[data-theme="dark"] {
  --bg: #0b1114; --bg-tint: #0f171b; --surface: #141c20; --surface-2: #1b252a; --surface-3: #243037;
  --sep: #223038; --sep-strong: #36464f;
  --text: #e8eef1; --text-2: #a4b2b9; --text-3: #87969d;
  --brand: #4fd1a5; --brand-hover: #6fdcb7; --on-brand: #05231a; --btn: #0f7a5c; --on-btn: #ffffff;
  --brand-soft: #12322a; --on-brand-soft: #a6ecd3;
  --bar: #1d3b27; --on-bar: #eef1e8;
  --hero-1: #1d3b27; --hero-2: #0f4a3c; --hero-3: #0d5a4d; --on-hero: #ffffff; --on-hero-2: #c4e3d8;
  --cat-stock: #11694c;   --cat-stock-soft: #123128;   --cat-stock-ink: #5fd6a8;
  --cat-journal: #5530a3; --cat-journal-soft: #251a3f; --cat-journal-ink: #b9a0ff;
  --cat-rx: #2449a6;      --cat-rx-soft: #16233f;      --cat-rx-ink: #93b4ff;
  --cat-strain: #0d5f6f;  --cat-strain-soft: #0f2c33;  --cat-strain-ink: #62cde0;
  --cat-social: #9e2459;  --cat-social-soft: #36172a;  --cat-social-ink: #ff93c2;
  --cat-learn: #7a4e05;   --cat-learn-soft: #33260c;   --cat-learn-ink: #f2bd63;
  --warn: #ffa66b; --warn-soft: #38200f; --danger: #ff9b9b; --danger-soft: #3a1717; --ok: #5fd6a8; --ok-soft: #123128;
  --shadow-card: 0 1px 2px rgba(0, 0, 0, .4), 0 8px 24px rgba(0, 0, 0, .3);
}
```
W B `--cat-x` to **wypełnienie z białym tekstem** (kafle KPI, inicjały), a ikony na tle `--cat-x-soft` są w `--cat-x-ink`.

### Kontrast (WCAG 2.1, sprawdzone liczbowo)

Wszystkie 194 pary przechodzą: tekst 4,5:1, ikony i elementy graficzne 3:1. Najniższe wartości:

| Para | A jasny | A ciemny | B jasny | B ciemny |
|---|---|---|---|---|
| `--text-3` na `--bg` (podpowiedzi) | 4,73 | 6,31 | 4,87 | 6,23 |
| `--text-2` na najciemniejszym `--cat-*-soft` | 5,98 | 6,47 | 6,15 | 6,45 |
| `--cat-*-ink` na `--cat-*-soft` (min.) | 7,34 | 9,09 | 6,90 | 7,34 |
| ikona `--cat-*` na `--cat-*-soft` (min., 3:1) | 4,52 | 7,05 | n/d (ink) | n/d (ink) |
| biały na `--cat-*` (min.) | n/d | n/d | 5,34 | 6,67 |
| `--on-btn` na `--btn` | 6,44 | 5,23 | 6,47 | 5,30 |
| `--warn` na `--warn-soft` | 5,08 | 8,25 | 5,00 | 7,90 |
| `--danger` na `--danger-soft` | 5,59 | 7,59 | 4,82 | 7,92 |
| `--on-hero-2` na `--hero-3` (podpisy w hero) | n/d | n/d | 4,51 | 5,92 |
| `--on-bar` na `--bar` | 14,33 | 15,28 | 10,77 | 10,77 |
| biały na drugorzędnym przycisku hero (`rgba(0,0,0,.18)` na `--hero-3`) | n/d | n/d | 7,48 | 10,17 |
| biały na drugorzędnym przycisku hero dziennika (to samo na `--cat-journal`) | n/d | n/d | 9,09 | ≥ 9 |

Uwaga: półprzezroczysta biel (`rgba(255,255,255,.14)`) na `--hero-3` daje tylko 4,27:1 dla 16 px, więc przyciski i pola na hero przyciemniamy, a nie rozjaśniamy.

Skrypt kontroli: `docs/design3/kontrast.mjs` z wartościami w `docs/design3/tokens.mjs` (`node docs/design3/kontrast.mjs`, z `--md` wypisuje wszystkie pary). Liczy luminancję względną sRGB dla par `tekst/tło` z listy wyżej, dla każdej kategorii w obu motywach. W etapie 0 przenieść go do `tests/theme.test.js` (czytając wartości z `globals.css`). Wykresy: `--chart-*` na `--cat-*-soft` nie są dozwolone (seria leży zawsze na `--surface`), a w A seria z jedną kategorią może użyć `--cat-x` (≥ 3:1 do `--surface`: min. 5,26 jasny, 7,62 ciemny).

## 6. Nowe zasady (zastępują punkty 3–5 w DESIGN.md)

1. **Kolor oznacza obszar.** Każdy obszar ma kolor kategorii: zapas i zużycie, dziennik i objawy, recepty, odmiany, społeczność, wiedza i raport. Kolor pojawia się w ikonie sekcji, tle karty tematycznej, aktywnej zakładce i chipie wybranym na ekranie tego obszaru. Nowy obszar wymaga nowej pary tokenów, a nie losowego koloru.
2. **Jedna rzecz najważniejsza na ekranie.** Każdy ekran ma jeden „bohater”: kartę tonalną albo hero z jedną dużą liczbą (Fraunces 48–56). Pozostałe liczby mają co najwyżej 24–34 px.
3. **Warstwy zamiast linii.** Karty mają cień `--shadow-card` i promień 22, a tło strony jest wyraźnie inne niż karta. Linie zostają tylko wewnątrz kart (wiersze listy). Karta w karcie jest dozwolona tylko jako biała „wyspa” na karcie tonalnej.
4. **Akcja główna ma zawsze ten sam kolor** (`--btn`), niezależnie od obszaru. Kolor kategorii nie jest kolorem przycisku głównego, najwyżej przycisku miękkiego (`--cat-x-soft` z `--cat-x-ink`).
5. **Stany mają pierwszeństwo przed kategoriami.** `--warn` i `--danger` pojawiają się tylko przy powodzie („Kończy się”, recepta < 7 dni, błąd). Informacja („Dane są prywatne”) nie używa koloru ostrzeżenia, tylko neutralnego `--surface-2`.
6. **Ikony w kółkach.** Ikona sekcji ma 36–44 px kółka (miękkie albo pełne). Ikony w wierszach list nawigacyjnych (arkusz „Więcej”) też dostają kółka w kolorze grupy (Dziennik fiolet, Odkrywaj morski/malinowy, Konto neutralne).
7. **Rodzaj odmiany zostaje znacznikiem danych.** `--kind-*` w kropce, w kafelku miniatury i w chipie filtra. Nie jest kolorem kategorii „odmiany” (ten jest morski).
8. **Bez konopi poza znakiem marki.** Odmiana ma ikonę słoika (`jar`), olej kropli (`drop`). Mikroilustracje rysujemy z prostych kształtów i kolorów kategorii, bez liści, postaci i stocków. Inicjały odmiany (kierunek B) są nazwą, więc dostają `.dn`.
9. **Zostaje bez zmian:** cele 44 px, pola 16 px, `prefers-reduced-motion`, zasady treści, liczby z przecinkiem, wykresy z tokenów `--chart-*`.

## 7. Plan wdrożenia pod kierunek A (nieaktualny; plan pod B w sekcji 0, ryzyka poniżej obowiązują)

Opis dotyczy rekomendacji (A z elementami B). Dla czystego B etap 0 dochodzi do hero i pierścienia, a S1 do S3 wyglądają tak samo.

### Etap 0: tokeny i komponenty bazowe (jeden agent, przed resztą)
Pliki: `app/globals.css`, `app/components/Icon.js`, `app/styles/nav.css`, `app/components/BottomNav.js` (dolny pasek i arkusz „Więcej” `nav.sheet`), `app/components/navItems.js`, `app/components/Header.js`, `app/components/TopNav.js`, `app/layout.js` (`themeColor`), `mobile/capacitor.config.js`, `app/styles/platform.css` i `auth.css` (tylko przepięcie z `--bar`), `tests/theme.test.js`, `tests/e2e/zielnik.test.mjs` (tylko scenariusze nawigacji), `docs/DESIGN.md`.
- Tokeny z sekcji 5 w trzech blokach. Aliasy starych nazw. Nowy test: pary kontrastu `--cat-*` w obu motywach i obecność `--cat-*`, `--btn`, `--on-btn` w trzech blokach. Paleta `--chart-*` bez zmian.
- Komponenty CSS:
  - `.card` z cieniem i promieniem 22
  - `.card.tint[data-cat=x]` albo `.tint-x`
  - `.ic-dot` (kółko 36/44, warianty `soft` i `solid`, klasa kategorii)
  - `.sec-head` (kółko, `h2`, akcja po prawej)
  - `.tile` (szybki kafel)
  - `.btn.soft`
  - `.chip.on` w kolorze kategorii (`--chip-on` ustawiane na ekranie)
  - `.big-num`
- `Icon.js`: nowe ikony `jar`, `drop`, `home`, `cart`, `zap`, `smile`, `moon` (już jest), `wave`, `flask`, `bell` (ścieżki w `docs/design3/*.html`).
- Nawigacja: dolny pasek Dziś, Odmiany, „+”, Dziennik, Więcej z kolorową pigułką aktywnej zakładki (pole `cat` w `navItems.js`). „+” w pasku zamiast pływającego `.fab`. Jasny górny pasek (`--bar` = `--bg`). Arkusz „Więcej” z kółkami ikon w kolorach grup też należy do etapu 0, bo żyje w `BottomNav.js` i `nav.css`.
- **Decyzja właściciela przed etapem 0:** nowy podział zakładek (Katalog, Szukaj i Znajomi przechodzą do Odmian i do „Więcej”) i to, czy lista odmian zostaje pod Dziś na `/`, czy dostaje własną trasę (np. `/odmiany`). Wpływa na S1 i S2.

### Etap 1: trzy równoległe strumienie (rozłączne pliki)
Każdy strumień zmienia tylko swoje pliki. Globalnego CSS nie zmienia; brakujący komponent bazowy zgłasza w raporcie.

**S1: Dziś i onboarding** (nawigacja i arkusz „Więcej” są już po etapie 0)
- Pliki:
  - `app/page.js`
  - `app/components/TodayBoard.js`, `TodayPanel.js`, `HomeStore.js`, `QuickActions.js`, `SymptomsQuick.js`, `NoUseToday.js`
  - `app/components/MoreMenu.js` (menu „Więcej” na desktopie), `Onboarding.js`, `WhatsNew.js`
  - `app/components/charts/StockForecast.js`, `UsageDays.js` (tylko opakowanie, bez kolorów serii; reguły w `home.css`)
  - `app/styles/home.css`, `app/styles/system.css`
- Dziś według `a-dzis.png`:
  - karta tonalna zapasu z miernikiem dni
  - szybkie kafle
  - wykres 14 dni w karcie z nagłówkiem
  - karta recept z odliczaniem w kwadracie
  - karta tonalna „Jak się dziś czujesz?”
  - lista „Do zrobienia”

**S2: odmiany**
- Pliki:
  - `app/components/StrainsBoard.js`, `StrainCard.js`, `StrainDetail.js`, `CharacteristicCard.js`, `Effects.js`, `StrainHistory.js`, `StrainProposals.js`, `Tests.js`
  - `app/strains/[id]/*`, `app/katalog/*`, `app/compare/page.js`, `app/rankings/*`, `app/wheel/*`
  - `app/styles/strains.css`, `detail.css`, `catalog.css`, `rankings.css`, `proposals.css`
- Lista według `a-odmiany.png`:
  - karta z miniaturą (słoik albo kropla w kolorze rodzaju)
  - ocena w kółku
  - stopka ze stanem i jedną akcją
  - „Porównaj” i „Edytuj” przenieść do szczegółów albo do menu karty
- Szczegóły według `a-odmiana.png`:
  - ilustracja zastępcza zamiast pustego prostokąta, gdy nie ma zdjęcia
  - trzy kafle ocen
  - karty z kółkami ikon
- Katalog, porównanie i rankingi: przełącznik „Moje / Katalog / Rankingi”.

**S3: dziennik, historia, recepty, raport, profil, obserwacje**
- Pliki:
  - `app/dziennik/*`, `app/historia/*`, `app/recepty/*`, `app/raport/*`, `app/profil/*`, `app/obserwacje/*`
  - `app/components/RxPicker.js`, `PharmacyLink.js`
  - `app/components/charts/SymptomsChart.js`, `UsageWeeks.js`, `WeeklyBars.js`, `PeriodCompare.js` (tylko opakowanie i nagłówki)
  - `app/styles/diary.css`, `history.css`, `profile.css`, `charts.css` (jedyny właściciel; S1 nie zmienia `charts.css`, tylko `home.css`), `content.css`
- Dziennik według `a-dziennik.png`: karta tonalna „Dziś” z suwakami w fiolecie, małe wykresy w kartach 2×2 z trendem w pigułce, notka prywatności neutralna.
- Recepty: niebieska kategoria, kwadraty dni.
- Historia: zielona kategoria.
- Raport: ochra.
- Profil: neutralny z kółkami ikon sekcji.

### Etap 2: QA (jeden agent)
- Kontrast: `tests/theme.test.js` i axe (`@axe-core/playwright` na 390 px) na `/`, `/strains/1`, `/dziennik`, `/historia`, `/recepty`, `/profil`, `/raport`, w obu motywach.
- Zrzuty: `scripts/dev/shots.mjs` 390 px jasny i ciemny, 320 px i 1280 px dla Dziś i odmian, z `--discreet`. W trybie dyskretnym nie może być liścia poza ukrytym znakiem marki, a nazwy i inicjały muszą być rozmyte.
- Wykresy: paleta `--chart-*` bez zmian, seria czytelna na `--surface` (karta), żadna seria na tle tonalnym. Sprawdzić `.ubar`, `.usage-chart`, `.uchart-plot`, `svg.sym-chart`.
- Lighthouse (`npm run test:perf`): cień i więcej SVG nie mogą przekroczyć budżetu CLS 0,05 i JS. Ilustracje wyłącznie inline SVG albo CSS, bez obrazów.
- Ręcznie na telefonie: pasek stanu w obu motywach (Android), duży tekst (`html.big-ui`), wydruk raportu.

### Ryzyka
- **Testy E2E opierają się na klasach:**
  - `.home-date`, `.bottomnav`, `.topbar .nav`
  - `.kpi-big`, `.quick-msg`, `.pharmacy-rx`, `.fb-row`, `.badge`, `.trx`
  - `.usage-sel`, `.usage-scrub`, `.sym-custom`, `svg.sym-chart`
  - `.onb`, `.consent-gate`, `.lock-setup`, `.report-sheet`, `.proposal-box`, `.proposal-item`
  - `nav.sheet a`, `details.stock-notes`, `details.terp summary`, `.dn`

  Strumienie zachowują te klasy (mogą dokładać nowe) i nie zmieniają `tests/e2e/zielnik.test.mjs`, bo to jeden plik i trzy strumienie wchodziłyby sobie w drogę. Scenariusze nawigacji (zakładki, arkusz „Więcej”) poprawia etap 0, a pozostałe, jeśli trzeba, QA w etapie 2.
- **`tests/theme.test.js`:** każdy nowy kolor musi być w trzech blokach. Paleta wykresów jest przypięta, więc jej zmiana wymaga ponownej walidacji (skill dataviz) i aktualizacji testu oraz `docs/UI-2.md`.
- **Pasek stanu:** jasny górny pasek w A wymaga zmiany `themeColor` w `app/layout.js` (tablica z `media` dla jasnego i ciemnego), `mobile/capacitor.config.js` (`StatusBar.style` przełączany w `NativeShell` zależnie od motywu, `backgroundColor`) i przebudowy aplikacji Android. Ekran blokady (`.native-lock`, `html[data-applock]` w `platform.css`) i logowanie (`.auth-art`, `.auth-mark` w `auth.css`) używają `--bar` jako tła: przed zmianą dodać `--brand-deep: #1d3b27` (z `--on-brand-deep`) i przepiąć te reguły. Kierunek B tego ryzyka nie ma.
- **Budżet Lighthouse:** cienie na wielu kartach i inline SVG ilustracji to więcej malowania (TBT) i większy HTML. Ilustracje dzielić jako komponenty, nie wklejać w każdej karcie.
- **Tryb dyskretny:** ilustracja zastępcza i miniatury nie mogą wyglądać jak konopie. Inicjały w B muszą mieć `.dn`.
- **Treści z makiet** („Dzień dobry, Ania”, „do 4 listopada”, lista „Do zrobienia”) wymagają danych, których panel dziś nie liczy w jednym miejscu (data końca zapasu jest w prognozie, wizyta w przypomnieniach). S1 sprawdza źródła przed wdrożeniem, a brakujące rzeczy pomija.
