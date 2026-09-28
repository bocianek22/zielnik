// Treści edukacyjne. Nie są poradą medyczną; wiele efektów terpenów opisano głównie w badaniach na zwierzętach lub komórkach.
export const ARTICLES = [
  {
    id: 'terpeny', title: 'Czym są terpeny',
    text: [
      'Terpeny to lotne związki aromatyczne wytwarzane przez wiele roślin: skórkę cytrusów, lawendę, sosnę, chmiel i pieprz. W konopiach jest ich kilkaset i to głównie one odpowiadają za zapach oraz smak odmiany.',
      'Powstają w tych samych gruczołach co kannabinoidy (trichomach). Są lotne, dlatego tracą się przy zbyt długim przechowywaniu w cieple i świetle, przy zbyt drobnym rozdrobnieniu i przy bardzo wysokiej temperaturze ogrzewania.',
      'Popularna hipoteza „efektu entourage” zakłada, że terpeny i kannabinoidy działają razem inaczej niż osobno. To wciąż hipoteza: badań na ludziach jest mało, a ich wyniki są niejednoznaczne. Dlatego opisy „ten terpen relaksuje, tamten pobudza” traktuj jako wskazówki, a nie pewniki.',
    ],
  },
  {
    id: 'trichomy', title: 'Czym są trichomy',
    text: [
      'Trichomy to mikroskopijne gruczoły żywiczne na kwiatach i liściach, wyglądające jak szron lub cukier puder. Wytwarzają i magazynują kannabinoidy (w postaci kwasowej, np. THCA i CBDA) oraz terpeny. Najważniejsze są trichomy główkowe na szypułce: to ich „główki” pękają przy dotyku.',
    ],
    list: [
      ['Przezroczyste', 'Niedojrzałe, kannabinoidów jest jeszcze mało.'],
      ['Mleczne (białe)', 'Uznawane za okres najwyższej zawartości THC, zwykle wtedy zbiera się kwiaty.'],
      ['Bursztynowe', 'Późniejsze stadium: THC częściowo rozkłada się do CBN, a działanie bywa opisywane jako spokojniejsze.'],
    ],
    after: 'Dobrze zachowane, lśniące trichomy są jednym z oznak świeżości i ostrożnej obróbki. Oderwane trichomy tworzą kief. Jakość potwierdza jednak przede wszystkim certyfikat badań (COA) na opakowaniu lub w dokumentacji partii.',
  },
  {
    id: 'rodzaje', title: 'Indica, sativa i hybryda',
    text: [
      'Historycznie sativa oznaczała wysokie rośliny o wąskich liściach z ciepłych regionów, a indica niższe, krzaczaste rośliny o szerokich liściach z rejonu Hindukuszu. W obiegu przyjęło się, że indica „uspokaja”, a sativa „pobudza”.',
      'Badania genetyczne i chemiczne pokazują, że te etykiety na rynku słabo przewidują skład i działanie. Bardziej informatywne jest stężenie THC i CBD oraz profil terpenowy. Prawie wszystkie współczesne odmiany są mieszańcami (hybrydami), które dzieli się umownie na dominujące w kierunku sativa, dominujące w kierunku indica i zrównoważone.',
      'Rodzaj bywa więc użyteczny jako orientacyjny opis pokroju rośliny i rodowodu, ale nie jako gwarancja efektu. Osobiste oceny w Zielniku przydadzą się tu bardziej niż etykieta.',
    ],
  },
  {
    id: 'kush-haze-sour', title: 'Kush, Haze i Sour: czym się różnią',
    text: ['To nazwy rodzin odmian, a nie ścisłe kategorie botaniczne. Cechy poniżej są typowe, ale konkretna partia potrafi je łamać.'],
    list: [
      ['Kush', 'Wywodzi się od indik z gór Hindukuszu (rodziny OG Kush, Bubba Kush, Master Kush). Aromat ziemisty, sosnowy, przyprawowy, często z nutą paliwa. Pąki zwykle zwarte i gęste. Często dominuje mircen, kariofilen i limonen. Reputacja: ciężki, wyciszający.'],
      ['Haze', 'Rodzina sativa-dominant, wywodzona z krzyżowania landrace’ów (m.in. kolumbijskich, meksykańskich, tajskich i południowoindyjskich) w Kalifornii. Aromat cytrusowo-kadzidlany, korzenny, ziołowy. Pąki luźniejsze, długi czas kwitnienia. Często wyraźny terpinolen. Reputacja: lekki, pobudzający, „głowowy”.'],
      ['Sour', 'Od rodziny Sour Diesel (Nowy Jork, lata 90.; pochodzenie bywa opisywane jako Chemdawg × Super Skunk). Aromat ostry, paliwowo-cytrusowy, „skunkowy”. Badania z 2021 r. wskazały lotne związki siarki (tiole), a nie same terpeny, jako źródło zapachu skunk. Reputacja: energetyczny, pobudzający.'],
    ],
    after: 'W skrócie: Kush to ziemia i sosna („ciężki”), Haze to cytrus i kadzidło („lekki”), Sour to paliwo i cytryna („ostry”). Zawsze sprawdzaj stężenia i profil w dokumentacji konkretnej partii.',
  },
  {
    id: 'thc-cbd', title: 'THC, CBD i etykieta',
    text: [
      'W surowym kwiecie kannabinoidy są głównie w formie kwasowej (THCA, CBDA) i dopiero pod wpływem ciepła zamieniają się w THC i CBD. Procent na opakowaniu to zwykle suma po przeliczeniu.',
      'Dwie partie tej samej odmiany mogą się różnić o kilka punktów procentowych, dlatego w Zielniku pula „do wykupienia” łączy odmiany o tym samym producencie oraz stężeniu THC i CBD (jedna recepta).',
    ],
  },
  {
    id: 'etykieta-coa', title: 'Jak czytać etykietę i certyfikat badań (COA)',
    text: [
      'Etykieta suszu leczniczego zwykle podaje producenta, nazwę odmiany, numer serii, stężenie THC i CBD (w procentach), masę opakowania i termin ważności. Te same dane warto zapisać w Zielniku (seria, ważność, stężenia), bo dwie partie tej samej odmiany mogą się od siebie różnić.',
      'COA (certyfikat analizy, ang. Certificate of Analysis) to dokument z badania laboratoryjnego konkretnej partii. Zwykle zawiera profil kannabinoidów, często także terpenów, oraz wyniki badań czystości. Numer serii na opakowaniu powinien zgadzać się z numerem na certyfikacie.',
    ],
    list: [
      ['THC całkowite', 'Surowy kwiat zawiera głównie kwasową formę THCA. „THC całkowite” zwykle liczy się jako THC + 0,877 × THCA, dlatego bywa wyższe niż samo THC. Sprawdź, którą wartość podaje producent.'],
      ['CBD całkowite', 'Analogicznie: CBD + 0,877 × CBDA.'],
      ['Profil terpenowy', 'Jeśli certyfikat go zawiera, możesz przenieść dominujące terpeny do karty odmiany w Zielniku.'],
      ['Czystość', 'Sekcje dotyczące metali ciężkich, pestycydów, mikrobiologii i mykotoksyn pokazują, czy partia mieści się w dopuszczalnych limitach.'],
      ['Termin ważności i przechowywanie', 'Po terminie ważności albo przy oznakach pleśni lub nietypowym zapachu nie używaj suszu i skonsultuj się z farmaceutą.'],
    ],
    after: 'Zielnik nie weryfikuje certyfikatów. Wyniki dotyczą konkretnej partii, a nie całej odmiany. W razie wątpliwości co do jakości zapytaj farmaceutę w aptece lub lekarza prowadzącego.',
  },
  {
    id: 'slownik', title: 'Słownik pojęć',
    text: ['Krótkie wyjaśnienia terminów, które pojawiają się w aplikacji i na opakowaniach.'],
    list: [
      ['Kannabinoidy', 'Związki chemiczne występujące w konopiach, m.in. THC, CBD, CBN i CBG.'],
      ['THC', 'Główny związek odpowiedzialny za działanie psychoaktywne.'],
      ['CBD', 'Kannabinoid, który nie wywołuje odurzenia typowego dla THC.'],
      ['CBN', 'Powstaje głównie z rozkładu THC, np. podczas długiego przechowywania.'],
      ['CBG', 'Kannabinoid występujący zwykle w małych ilościach. Jego kwasowa forma (CBGA) jest prekursorem innych kannabinoidów.'],
      ['Dekarboksylacja', 'Utrata grupy karboksylowej z kwasowych form (THCA, CBDA) pod wpływem ciepła, dzięki czemu powstają THC i CBD.'],
      ['Efekt entourage', 'Hipoteza, że kannabinoidy i terpeny działają razem inaczej niż osobno. Nadal wymaga badań.'],
      ['Chemotyp', 'Profil chemiczny rośliny (proporcje kannabinoidów i terpenów). Bardziej informacyjny niż podział indica/sativa.'],
      ['Landrace', 'Odmiana lokalna, rozwijana naturalnie w danym regionie, bez krzyżowania z odmianami z innych stron świata.'],
      ['Seria (partia)', 'Konkretna produkcja suszu z jednego zbioru i jednego badania. Stężenia mogą różnić się między seriami.'],
      ['COA', 'Certyfikat analizy laboratoryjnej danej partii.'],
      ['Terpeny', 'Lotne związki aromatyczne odpowiadające za zapach i smak.'],
      ['Trichomy', 'Gruczoły żywiczne na kwiecie, w których powstają kannabinoidy i terpeny.'],
      ['Kief', 'Odłamane trichomy w postaci drobnego proszku.'],
    ],
  },
];

export const TERPENES = [
  { name: 'Mircen', aroma: 'ziemisty, piżmowy, dojrzałe mango, chmiel', found: 'chmiel, mango, tymianek, werbena', known: 'Często najobfitszy terpen w konopiach. Popularne twierdzenie o działaniu usypiającym nie ma solidnego poparcia w badaniach na ludziach; w modelach zwierzęcych obserwowano działanie przeciwzapalne i przeciwbólowe.' },
  { name: 'Limonen', aroma: 'cytrusowy, cytryna, pomarańcza', found: 'skórki cytrusów, jałowiec, mięta', known: 'W badaniach na zwierzętach i w małych badaniach z aromaterapią wiązany z poprawą nastroju i mniejszym lękiem. Dowody u ludzi są ograniczone.' },
  { name: 'Kariofilen (beta)', aroma: 'pieprz, goździk, korzenny', found: 'czarny pieprz, goździki, oregano, cynamon', known: 'Wyjątkowy: wiąże się z receptorem kannabinoidowym CB2. W badaniach przedklinicznych wykazywał działanie przeciwzapalne i przeciwbólowe.' },
  { name: 'Linalol', aroma: 'lawenda, kwiatowy, lekko korzenny', found: 'lawenda, bazylia, kolendra', known: 'W badaniach przedklinicznych działanie uspokajające i przeciwlękowe; aromaterapia lawendą ma badania kliniczne, ale nie jest to dowód dla samych konopi.' },
  { name: 'Pinen (alfa i beta)', aroma: 'sosna, żywica, świeże igły', found: 'sosna, rozmaryn, szałwia, koper', known: 'Alfa-pinen bywa opisywany jako rozszerzający oskrzela. Hipoteza, że łagodzi zaburzenia pamięci po THC, jest mało potwierdzona.' },
  { name: 'Humulen', aroma: 'chmiel, drzewny, ziemisty', found: 'chmiel, szałwia, żeń-szeń', known: 'Działanie przeciwzapalne w modelach przedklinicznych. Rzekome hamowanie apetytu opiera się głównie na przekazach anegdotycznych.' },
  { name: 'Terpinolen', aroma: 'świeży, sosnowo-kwiatowy, ziołowy, lekko cytrusowy', found: 'bez, jabłka, kminek, tymianek', known: 'Typowy dla wielu odmian z rodziny Haze. W badaniach na myszach łagodne działanie uspokajające i antyoksydacyjne.' },
  { name: 'Ocymen', aroma: 'słodki, ziołowy, drzewny, lekko cytrusowy', found: 'bazylia, mango, mięta, pietruszka', known: 'Słabo zbadany. Opisywano działanie przeciwzapalne i przeciwgrzybicze w badaniach laboratoryjnych.' },
  { name: 'Bisabolol (alfa)', aroma: 'rumianek, kwiatowy, miodowy', found: 'rumianek, kwiat kandyty', known: 'Stosowany w kosmetykach do łagodzenia skóry. Działanie przeciwzapalne w badaniach przedklinicznych.' },
  { name: 'Nerolidol', aroma: 'drzewny, kora, kwiatowo-cytrusowy', found: 'imbir, jaśmin, drzewo herbaciane', known: 'W badaniach przedklinicznych działanie uspokajające i przeciwpasożytnicze; ułatwia przenikanie związków przez skórę.' },
  { name: 'Farnezen', aroma: 'zielone jabłko, drzewny, kwiatowy', found: 'skórka jabłek, imbir, chmiel', known: 'Bardzo mało danych. Opisywane jest głównie jego znaczenie dla zapachu.' },
  { name: 'Gwajol', aroma: 'sosnowy, kwiatowy, lekko dymny', found: 'drzewo gwajakowe, wiesiołek', known: 'Mało danych; w badaniach laboratoryjnych opisywano działanie przeciwzapalne i przeciwdrobnoustrojowe.' },
  { name: 'Geraniol', aroma: 'róża, geranium, słodki kwiatowy', found: 'róża, geranium, trawa cytrynowa', known: 'W badaniach przedklinicznych działanie neuroprotekcyjne i przeciwzapalne. W konopiach występuje rzadziej.' },
  { name: 'Eukaliptol (1,8-cyneol)', aroma: 'eukaliptus, mięta, kamforowy', found: 'eukaliptus, rozmaryn, szałwia', known: 'Stosowany w preparatach na dolegliwości dróg oddechowych; w konopiach zwykle w niewielkich ilościach.' },
];
