# Design 3.1: jakość wykonania

Prośba właściciela (10.10): podrasować UI do poziomu najlepszych aplikacji. Tożsamość zostaje (kierunek B z elementami A, `docs/DESIGN-3.md`). Zmieniamy tylko jakość wykonania: rytm, typografię liczb, zachowanie przy przewijaniu, arkusze, stany puste i ładowania.

Podstawa: zrzuty wersji 0.56.0 (390 px jasny i ciemny: `/`, `/odmiany`, `/strains/1`, `/dziennik`, `/historia`, `/recepty`, `/raport`, `/profil`, `/grupy`, `/znajomi`, arkusz „Więcej”, menu „+”; 1280 px: `/`, `/odmiany`, `/dziennik`; `/login`).

Wzorce, z których bierzemy zasadę, a nie wygląd:
- **Apple Health/Fitness:** duży tytuł przechodzi w kompaktowy pasek, a liczba z jednostką tworzy jeden blok.
- **Oura/Whoop:** jedna liczba-bohater na ekran, a pozostałe liczby są wyraźnie mniejsze.
- **Things 3/Linear:** gęste listy, jedno działanie na wiersz, reszta w menu.
- **Headspace/Calm:** ilustracja i jedno zdanie w pustym stanie, z jednym przyciskiem.
- **Revolut/Monzo:** reakcja na dotyk (skala, haptyka) i potwierdzenie z „Cofnij”.
- **Material 3 Expressive:** arkusz z uchwytem, który zamyka się gestem.
- **Airbnb:** szkielety w kształcie docelowej treści.

## 1. Co już jest na poziomie (nie ruszamy)
- **Hero:** gradient od koloru paska (pasek stanu bez zmian), pierścień dni zapasu i dwa przyciski.
- **Kolory i karty:** kolory obszarów (`--cat-*`), karty tonalne, kafle KPI, licznik dni.
- **Haptyka w APK (`native/behaviors.js`):** sukces i błąd przy każdym zapisie z dotyku, lekka przy przełącznikach i chipach.
- **Ruch i natywne odczucie:** przeciągnij, aby odświeżyć (`native/PullRefresh.js`), przejścia View Transitions w APK i w przeglądarce, mikroanimacje z szacunkiem dla `prefers-reduced-motion`.
- **Potwierdzenia:** `Toast` z akcją „Cofnij” i optymistyczne „Zużyłem” (`useQuickSave`).
- **Kontrast i dostępność:** kontrast pilnowany testem (`tests/theme.test.js`), axe w E2E, cele 44 px.

Wniosek: brakuje nie funkcji, tylko szlifu i spójności między ekranami.

## 2. Niedociągnięcia, ekran po ekranie

### Wspólne (wszystkie ekrany)
1. **Przewijanie:** po przewinięciu górny pasek z logo znika i nic nie mówi, gdzie jestem. iOS i Material pokazują wtedy kompaktowy pasek z nazwą ekranu. Pasek „Zielnik” na każdym ekranie powtarza markę zamiast nazwy ekranu.
2. **Dwa style nagłówków między kartami:** szara etykieta 14 px (`.section-label`: „Do zrobienia”, „Twoje grupy”) i `.sec-head` 17 px z kółkiem. Na jednym ekranie (Dziś) stoją obok siebie, przez co rytm się rwie.
3. **Liczba z jednostką się łamie:** „0,3” w jednej linii, „g” w następnej (Dziennik, kafel „Zużycie suszu”). Jednostki mają też różne wielkości: `.kt-value small` 15 px, `.big-num small` 20 px, a w historii „9” bez jednostki stoi niżej niż „3,3 g”.
4. **Arkusz „Więcej” i menu „+”** zamykają się tylko stuknięciem w tło. Uchwyt sugeruje gest, którego nie ma. W Material 3 i iOS arkusz zjeżdża w dół.
5. **Ikony aktywnej zakładki są liniowe**, tak jak nieaktywne. Różnicę robi tylko pigułka. Apple i Google dają aktywnej zakładce wariant wypełniony.
6. **Brak reakcji na dotyk** w przeglądarce i w APK poza haptyką: przyciski, kafle i wiersze nie „uginają się” (brak `:active` poza tłem wiersza).
7. **Stany puste to szara ikona liniowa 24 px**, tytuł i przycisk drugorzędny („Nie należysz do żadnej grupy”). Brak ilustracji i koloru obszaru.
8. **Ładowanie:**
   - szkielet to zawsze lista 4 wierszy, także dla Dziś (hero i kafle) i szczegółów odmiany, a treść przeskakuje po wczytaniu;
   - `app/loading.js` obsługuje wszystkie ekrany bez własnego `loading.js` i pokazywał nagłówek „Dziś” także w drodze do profilu czy dziennika;
   - górny i dolny pasek znikały na czas wczytywania, bo `Header` renderuje każda strona.
9. **Toast** wisi 84 px nad paskiem (pozostałość po pływającym „+”), nie ma ikony stanu, a tekst ma kolor sukcesu na białym tle zamiast neutralnego.
10. **Zdjęcia bez obsługi błędu:** niewczytane zdjęcie to biały prostokąt 270 px z ikoną przeglądarki i altem. W danych testowych plik jest celowo uszkodzony (seed zapisuje 108-bajtowy PNG bez danych), ale ten sam efekt da każde zdjęcie uszkodzone w sieci.

### Dziś (`/`)
- Hero jest dobre. Pod nim jest 7 bloków: 4 KPI, wykres, „Do zrobienia”, objawy, recepty i ustawienia. Kafel „Kończy się” powtarza pozycję „Kończy się zapas” z listy „Do zrobienia”.
- Karta wykresu ma 3 poziomy nagłówka: „Zużycie, 14 dni”, „Dziś 0,3 g” i przełącznik. Liczby zapasu powtarzają hero („Zapas suszu 8,5 g, starczy na 26 dni”).
- Recepty: tytuł wiersza powtarza liczbę z kwadratu („8 dni” i „wygasa za 8 dni”).
- Na 1280 px: siatka 2+2 KPI wygląda dobrze. Kolumna „Do zrobienia” kończy się wyżej niż wykres, przez co powstaje pusta dziura.

### Odmiany (`/odmiany`)
- Wiersz odmiany ma około 300 px: nazwa, meta, 3 chipy, pigułka stanu, 2 przyciski, „Szczegóły” i „…”. Na ekran mieszczą się 2,5 odmiany. Things/Linear: wiersz ≤ 88 px, działanie główne jedno, reszta w menu albo w szczegółach.
- Trzy kafle liczb (5 / 3 / 8,1) mają wagę KPI z Dziś, choć to podsumowanie listy. Wystarczy linia statystyk.
- „—” i „brak” przy ocenie zajmują tyle miejsca co ocena.

### Szczegóły odmiany (`/strains/[id]`)
- Ekran ma 11 000 px (dpr 2): wpis, skład, karta charakterystyki, pięć suwaków odczuć, opinie i testy, wszystko otwarte.
- Zdjęcie (albo jego brak) zajmuje 270 px w hero przed ocenami.
- „Zgłoś zdjęcie” wisi bez kontekstu pod kaflami.
- Formularz „Mój wpis” w połowie ekranu konkuruje z treścią do czytania. Lepiej, jak w Apple Health („Dodaj dane”), dać go w arkuszu albo zwinąć.

### Dziennik (`/dziennik`)
- Pięć wykresów jeden pod drugim, każdy z legendą skali. Długi akapit objaśnienia pod zużyciem.
- „0,3 g” się łamie (punkt 3 wspólnych).
- Wpis dnia jest na samym dole, a na telefonie to najczęstsza czynność. Oura i Whoop dają „dzisiejszy wpis” zaraz pod nagłówkiem.

### Historia, recepty, raport
- **Historia:** kafle „Zużyte 3,3 g / Aktywne dni 9 / Wykupione 0 g” mają różne linie bazowe.
- **Recepty:**
  - karta „W aptece” powtarza informację z kart recept („20 ml zostało na recepcie”);
  - zdania „10 ml liczone z szacunku (zakupy bez przypisania) — przypisz je w Historii.” są za długie i stoją pod każdą receptą.
- **Raport:**
  - hero i Recepty mają tę samą ikonę `file`;
  - pole daty w trybie przeglądarki angielskiej pokazuje „mm/dd/yyyy” (sprawdzić `lang="pl"` w polu i na telefonie);
  - akapit o PDF ma 4 linie.

### Profil (`/profil`)
- Ekran ma około 10 500 px (dpr 2): tożsamość, widoczność, linki, blokada, powiadomienia, przypomnienia, tryb dyskretny, wygląd, dane, sesje, usunięcie konta i „O aplikacji”, wszystko jako otwarte formularze.
- Wzorzec Ustawień iOS i Monzo: lista grup z wartością po prawej, każda grupa na osobnym ekranie albo w arkuszu.
- Przycisk „Zapisz profil” jest w środku ekranu, a ustawienia poniżej zapisują się same, co jest niespójne.

### Grupy, znajomi, czat
- **Pusty stan grup** ma dwa przyciski „Utwórz grupę” na jednym ekranie: w pustym stanie i w formularzu poniżej.
- **Czat:** „Ładuję…” zamiast szkieletu dymków.

### Logowanie (`/login`)
- Poprawne, ale puste w dolnej połowie. Logo jest małe, a ekran nie mówi, co aplikacja daje.
- Wzorzec Headspace i Oury: krótkie zdanie korzyści i ilustracja z kształtów (bez liścia w trybie dyskretnym, ekran jest przed zalogowaniem, więc bez danych).

### Ciemny motyw
- Dobry kontrast. Pełne kafle KPI (niebieski, fioletowy) są najjaśniejszymi plamami ekranu jaśniejszymi niż hero; dopuszczalne (zasada „najwyżej dwa pełne”).
- Cień kart w ciemnym motywie jest niewidoczny, więc karty odcina tylko `--card-line`. Wystarczy.

## 3. Lista zmian

Priorytety:
- **P1:** fundamenty we wspólnych plikach, zrobione w tym etapie.
- **P2:** ekrany w dwóch równoległych strumieniach.
- **P3:** później.

Wpływ to odczucie użytkownika:
- **duży:** widać od razu na każdym ekranie;
- **średni:** widać na jednym ekranie albo przy jednej czynności;
- **mały:** detal.

| # | Zmiana | P | Wpływ | Pliki |
|---|---|---|---|---|
| 1 | Kompaktowy pasek z nazwą ekranu po przewinięciu tytułu (jak „large title” w iOS) | P1 | duży | `components/CompactTitle.js`, `Header.js`, `globals.css` |
| 2 | Arkusz „Więcej” i menu „+” zamykane gestem w dół (uchwyt działa) | P1 | średni | `components/useSheetDrag.js`, `BottomNav.js`, `styles/nav.css` |
| 3 | Wypełniona ikona aktywnej zakładki (dom, słoik) albo grubsza kreska (dziennik, więcej) | P1 | średni | `Icon.js`, `BottomNav.js` |
| 4 | Liczba z jednostką nie łamie się; jedna skala jednostek (`.qty`, `.unit`) | P1 | średni | `globals.css` |
| 5 | Jeden styl nagłówka między kartami: `.section-title` (20/700, `--text`); `.section-label` zostaje dla formularzy i ustawień | P1 (klasa), P2 (użycie) | średni | `globals.css`, ekrany |
| 6 | Reakcja na dotyk: przyciski, kafle i wiersze lekko się uginają (`:active`, tylko bez „ogranicz ruch”) | P1 | średni | `globals.css` |
| 7 | Pusty stan z ilustracją SVG w kolorze obszaru (`EmptyState`, `Illustration`) | P1 (komponent), P2 (użycie) | duży | `components/EmptyState.js`, `Illustration.js`, `globals.css` |
| 8 | Szkielety w kształcie treści (ekran, lista, szczegóły, Dziś); paski zostają na miejscu w czasie wczytywania | P1 | średni | `Skeleton.js`, `LoadingShell.js`, `loading.js` tras, `system.css` |
| 9 | Toast: ikona stanu, neutralny tekst, tuż nad paskiem; haptyka zostaje w `installHaptics` (bez podwójnej) | P1 | średni | `Toast.js`, `system.css` |
| 10 | Haptyka „wybór” przy zmianie zakładki dolnego paska i segmentu | P1 | mały | `native/behaviors.js` |
| 11 | Lista odmian: wiersz ≤ 96 px (ikona, nazwa, meta, ocena, jedna pigułka „Zużyłem”), reszta w „…” | P2 S1 | duży | `StrainsBoard.js`, `StrainCard.js`, `strains.css` |
| 12 | Szczegóły odmiany: zdjęcie z obsługą błędu (ilustracja słoika), sekcje zwijane, „Mój wpis” w arkuszu | P2 S1 | duży | `StrainDetail.js`, `detail.css`, `strains/[id]/*` |
| 13 | Dziś: bez powtórzeń (kafel „Kończy się” albo pozycja listy, nie oba; recepta bez podwójnej liczby), `.section-title` | P2 S1 | średni | `TodayPanel.js`, `TodayBoard.js`, `home.css` |
| 14 | Dziennik: wpis dnia pod hero, wykresy zwięźlej, objaśnienie w `details` | P2 S2 | duży | `app/dziennik/*`, `diary.css`, `charts.css` |
| 15 | Profil jako lista grup (styl Ustawień) z podstronami albo zwijanymi sekcjami | P2 S2 | duży | `app/profil/*`, `profile.css` |
| 16 | Recepty i historia: krótsze teksty, wyrównane kafle (`.qty`), „W aptece” bez powtórzeń | P2 S2 | średni | `app/recepty/*`, `app/historia/*`, `history.css` |
| 17 | Grupy i znajomi: `EmptyState` z jednym przyciskiem, czat ze szkieletem dymków | P2 S2 | średni | `app/grupy/*`, `app/znajomi/*`, `social.css`, `chat.css` |
| 18 | Logowanie: zdanie korzyści i ilustracja | P3 | mały | `app/login/*`, `auth.css` |
| 19 | Przejście „wspólnego elementu” (karta odmiany → hero szczegółów) w View Transitions | P3 | mały | `strains.css`, `detail.css` |
| 20 | Onboarding w 3 krokach z ilustracjami `Illustration` | P3 | średni | `Onboarding.js` |

### Odrzucone (efekciarstwo albo ryzyko)
- **Przezroczysty, rozmyty dolny pasek (`backdrop-filter`):**
  - kontrast podpisów nad kolorowymi kaflami nie jest stały (axe);
  - na tanich WebView Androida przycina przewijanie.
- **Animowany wskaźnik przesuwający się w `.seg`:** ładny, ale wymaga JS na każdym przełączniku, a zysku nie ma.
- **Paralaksa hero i animowane liczby:** rozpraszają i kosztują TBT. `Bump` (błysk po zmianie) wystarcza.
- **Globalny „toaster” w układzie:** dokłada JS na każdej stronie. `Toast` przy komponencie wystarcza.
- **`navigator.vibrate`:** APK ma `@capacitor/haptics`, a w przeglądarce wibracja przy zapisie byłaby nachalna.
- **Nowe kolory:** paleta z Design 3 zostaje bez zmian.

## 4. Komponenty bazowe P1 (do użycia w S1 i S2)
- **Kompaktowy pasek (automatyczny):** pojawia się na telefonie, gdy pierwszy `h1` w `main` zniknie pod górną krawędzią. Ekran nic nie musi robić.
  - Tekst idzie z atrybutu i jest rysowany przez CSS, więc nie dubluje treści dla czytników i testów.
  - Gdy `h1` ma `.dn` albo zawiera `.dn`, pasek też jest rozmyty w trybie dyskretnym.
  - Ekran może podać krótszą nazwę: `data-short="…"` na `h1`.
  - Stuknięcie przewija do góry.
- **`.section-title`:** nagłówek między kartami (20/700). `.section-title.sm` ma 17/700.
- **`.qty` i `.unit`:**
  - `<span class="qty">0,3<span class="unit">g</span></span>` nie łamie się, a jednostka ma 0,55 em i grubość 700;
  - `.kt-value`, `.big-num` i `.day-count b` dostają `white-space: nowrap`.
- **`EmptyState` (komponent serwerowy):**
  - `<EmptyState art="jar|journal|rx|group|friends|search|chart|report" cat="strain" title="…" action={<Link className="btn">…</Link>}>Opis</EmptyState>`;
  - ilustracja w kolorach obszaru (`--c`, `--c-soft`, `--c-ink`), bez liści;
  - dla klienta jest `Illustration` (bez `'use client'`, działa w obu).
- **`Skeleton`:**
  - `variant="screen" | "list" | "detail" | "today" | "cards"`;
  - `rows` dla listy;
  - `role="status"` i „Wczytywanie”.
- **`LoadingShell` (do `loading.js`):**
  - `<LoadingShell title="Odmiany" variant="list" rows={6} />`;
  - górny pasek z marką i dolny pasek zostają na miejscu w czasie wczytywania;
  - `app/loading.js` używa neutralnego `screen` (bez tytułu „Dziś”), bo obsługuje wszystkie ekrany bez własnego `loading.js`;
  - nowy `loading.js` dla ekranu z długim wczytywaniem dodaje strumień, który jest właścicielem trasy.
- **`Toast`:**
  - bez zmian w API (`text`, `tone`, `action`, `onClose`, `duration`);
  - dochodzi ikona stanu;
  - klasy `.toast-text.quick-msg` i `.undo-btn` zostają.
- **`Icon`:**
  - `filled` rysuje wariant wypełniony (`home`, `jar`, `user`, `heart`, `file`, `calendar`);
  - ikony bez wariantu wypełnionego dostają grubszą kreskę (2,25), w tym samym polu, bez przesunięć.
- **`useSheetDrag(ref, active, onClose)`:**
  - gest w dół zamyka arkusz po przeciągnięciu o 80 px albo po szybkim ruchu;
  - przeciągnięcie zaczyna się tylko, gdy arkusz jest przewinięty do góry;
  - przy „ogranicz ruch” arkusz wraca bez animacji;
  - do użycia w każdym arkuszu z `useFocusTrap`.
- **Ugięcie przy dotyku:** `.btn`, `.kpi-tile` (link), `.chip` i `.tile` zmniejszają się do 0,97–0,98 przy `:active`.

## 5. Zlecenia dla strumieni (P2)

Wspólne zasady:
- **Nie zmieniaj plików zamrożonych:**
  - style i układ: `app/globals.css`, `app/styles/system.css`, `app/layout.js`, `app/loading.js`;
  - komponenty: `app/components/Icon.js`, `Header.js`, `CompactTitle.js`, `EmptyState.js`, `Illustration.js`, `Skeleton.js`, `LoadingShell.js`, `Toast.js`, `useSheetDrag.js`, `useFocusTrap.js`, `native/*`;
  - testy: `tests/e2e/zielnik.test.mjs`, `tests/theme.test.js`.

  Brakujący element bazowy opisz w raporcie.
- **Zachowaj klasy E2E** z `docs/DESIGN-3.md` (sekcja 7, „Ryzyka”) i `.dn` przy nazwach odmian.
- **Kolory tylko z tokenów**, cele 44 px, pola 16 px, polskie teksty w tonie istniejących.
- **Kontrole:** `npm run check && npm run lint && npm test && npm run build`, `npm run test:e2e`, zrzuty 390 px jasny i ciemny oraz `--discreet` zmienionych ekranów. Nie zmieniaj CHANGELOG, wersji, HANDOFF ani whats-new.

### S1: Dziś, nawigacja, odmiany
- **Pliki:**
  - `app/page.js`, `app/odmiany/*`, `app/strains/[id]/*`, `app/katalog/*`, `app/rankings/*`, `app/compare/page.js`, `app/wheel/*`, `app/szukaj/*`;
  - komponenty: `TodayBoard.js`, `TodayPanel.js`, `QuickActions.js`, `SymptomsQuick.js`, `NoUseToday.js`, `Onboarding.js`, `WhatsNew.js`, `BottomNav.js`, `TopNav.js`, `MoreMenu.js`, `navItems.js`, `StrainsBoard.js`, `StrainCard.js`, `StrainDetail.js`, `CharacteristicCard.js`, `Effects.js`, `StrainHistory.js`, `StrainProposals.js`, `Tests.js`, `StrainForm.js`, `Lightbox.js`, `SearchSuggest.js`;
  - wykresy: `charts/StockForecast.js`, `charts/UsageDays.js` (opakowanie);
  - style: `home.css`, `nav.css`, `strains.css`, `detail.css`, `catalog.css`, `rankings.css`, `proposals.css`, `forms.css`.
- **Zakres (punkty 11, 12 i 13 z tabeli):**
  - **Lista odmian:** jedna karta z wierszami ≤ 96 px:
    - kwadrat rodzaju z ikoną;
    - nazwa `.dn`, meta jednym wierszem;
    - ocena 800 po prawej;
    - pigułka stanu i jedno „Zużyłem”;
    - „Wykupiłem”, „Porównaj”, „Edytuj” w menu „…” (arkusz z `useSheetDrag`);
    - statystyki nad listą jedną linią zamiast trzech kafli.
  - **Szczegóły odmiany:**
    - `onError` na zdjęciu podmienia je na `<Illustration art="jar">` w kafelku rodzaju;
    - zdjęcie najwyżej 200 px albo miniatura w hero;
    - sekcje Skład, Charakterystyka, Odczucia, Opinie i Testy zwijane (`details` z `.sec-head`);
    - „Mój wpis” jako zwinięta karta albo arkusz;
    - „Zgłoś zdjęcie” w menu zdjęcia.
  - **Dziś:**
    - kafel „Kończy się” albo pozycja listy, nie oba;
    - wiersz recepty bez powtórzonej liczby („Olej 30 ml, ważna do 18.10”);
    - `.section-title` zamiast `.section-label` dla „Do zrobienia”;
    - karta wykresu bez powtórki zapasu z hero;
    - na 1280 px kolumny wyrównane.
  - **Puste stany** (`TodayPanel` „Dodaj odmianę”, katalog, rankingi, szukaj, koło) przez `EmptyState`.
  - **Toast w hero:** reguły `.hero .toast .btn*` w `home.css` nadpisują przycisk „Cofnij”; usuń je, żeby „Cofnij” wyglądał wszędzie jak w `system.css`.
  - **Wczytywanie list:** `odmiany`, `katalog` i `rankings` mają już `LoadingShell`. Brakujące `loading.js` (np. `/szukaj`) dodaj tym samym komponentem.
- **Zachowaj:** klasy z S1 i S2 w `docs/DESIGN-3.md` (etap 1 pod B), `nav.sheet a`, `.bottomnav`, `.fab`, `.fab-menu`.

### S2: dziennik, historia, recepty, raport, profil, grupy i czat
- **Pliki:**
  - `app/dziennik/*`, `app/historia/*`, `app/recepty/*`, `app/raport/*`, `app/profil/*`, `app/obserwacje/*`, `app/grupy/*`, `app/znajomi/*`, `app/u/*`, `app/login/*`, `app/register/*`;
  - komponenty: `RxPicker.js`, `PharmacyLink.js`, `BatchNote.js`, `DictateButton.js`, `Avatar.js`;
  - wykresy: `charts/SymptomsChart.js`, `UsageWeeks.js`, `WeeklyBars.js`, `PeriodCompare.js`;
  - style: `diary.css`, `history.css`, `profile.css`, `charts.css` (jedyny właściciel), `content.css`, `screens.css`, `social.css`, `chat.css`, `auth.css`.
- **Zakres (punkty 14–17, opcjonalnie 18):**
  - **Dziennik:**
    - wpis dnia zaraz pod hero;
    - kafel „Zużycie suszu” z `.qty`;
    - objaśnienie metody w `details` („Jak czytać wykres”);
    - nagłówki między kartami jako `.section-title`.
  - **Profil:**
    - na górze karta tożsamości (awatar, nazwa, „Edytuj”);
    - pod nią lista grup w stylu Ustawień (`.list` z `.ic-dot` i wartością po prawej: „Widoczność: Znajomi”, „Blokada: wyłączona”);
    - każda grupa zwijana albo na podstronie;
    - zachowaj `.lock-setup`, `section[aria-labelledby=remind-h]`, `#remind-*`.
  - **Recepty:**
    - teksty o szacunku skrócone do jednej linii z linkiem;
    - „W aptece” bez powtórzeń;
    - `.day-count` w każdym wierszu.
  - **Historia:** kafle z `.qty` na wspólnej linii bazowej.
  - **Raport:**
    - własna ikona hero (`clipboard`);
    - pole daty z `lang="pl"`;
    - akapit o PDF w jednym zdaniu z `details`.
  - **Grupy i znajomi:**
    - `EmptyState art="group"` / `"friends"` z jednym przyciskiem, który przewija do formularza albo otwiera go;
    - czat ze szkieletem dymków zamiast „Ładuję…” (klasa `.chat-empty` zostaje dla pustego czatu).
- **Zachowaj:** klasy S3 z `docs/DESIGN-3.md` (`.sym-custom`, `svg.sym-chart`, `.pharmacy*`, `.doctor-notes`, `.dn-list`, `.report-*`, `.lock-setup`, `.fb-row`, `.trx`, `.badge`).

## 6. Ręczny test na telefonie po P1
- **Kompaktowy pasek w APK:**
  - kolor ciągły z paskiem stanu;
  - odstęp od wycięcia aparatu;
  - nie zasłania wskaźnika „przeciągnij, aby odświeżyć”.
- **Gest arkusza:** przeciągnięcie w dół zamyka „Więcej” i „+”, przewijanie długiego arkusza nie zamyka go przypadkiem.
- **Haptyka:** przy zmianie zakładki lekka, przy zapisie jedna (nie podwójna).
- **„Ogranicz ruch”:** brak animacji paska, arkusza i ugięć.
- **Duży tekst (`html.big-ui`):** pasek i jednostki `.qty` się mieszczą.
- **Wczytywanie na wolnej sieci:** paski stoją w miejscu, szkielet nie miga, a po wczytaniu treść nie skacze.
