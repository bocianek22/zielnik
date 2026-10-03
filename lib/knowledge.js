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
    id: 'kannabinoidy', title: 'Kannabinoidy: THC, CBD, CBN i CBG',
    text: [
      'Kannabinoidy to grupa związków występujących w konopiach. Najlepiej poznane są THC i CBD, a w mniejszych ilościach występują m.in. CBN i CBG. W kwiecie przeważają formy kwasowe (np. THCA, CBDA), które dopiero pod wpływem ciepła zamieniają się w THC i CBD.',
      'Poniżej krótkie, ostrożne podsumowanie. Dowody z badań na ludziach są dla większości kannabinoidów ograniczone, a wiele opisów pochodzi z badań laboratoryjnych i na zwierzętach.',
    ],
    list: [
      ['THC', 'Odpowiada za działanie psychoaktywne (odurzające). To zwykle główny kannabinoid w odmianach z apteki, a jego stężenie jest podawane na opakowaniu.'],
      ['CBD', 'Nie wywołuje odurzenia typowego dla THC. Występuje w niewielkiej ilości w większości odmian typu THC, a w odmianach zrównoważonych (np. 8% THC i 8% CBD) jest równorzędnym składnikiem. Może wpływać na metabolizm niektórych leków (patrz artykuł o interakcjach).'],
      ['CBN', 'Powstaje głównie z rozkładu THC (pod wpływem tlenu, światła i ciepła), dlatego jego większa ilość wskazuje na starszy lub źle przechowywany susz. Jest słabo działającym agonistą receptora CB1. Badań z udziałem ludzi, np. nad snem, jest niewiele i nie przesądzają one o działaniu.'],
      ['CBG', 'Prekursor innych kannabinoidów (jego forma kwasowa, CBGA, jest punktem wyjścia dla THCA i CBDA); w dojrzałym kwiecie zwykle jest go niewiele. Nie wywołuje odurzenia. Dowody kliniczne są bardzo skromne: pojedyncze, małe badania u zdrowych osób, bez potwierdzonych wskazań leczniczych.'],
    ],
    after: 'Procent kannabinoidów na opakowaniu opisuje konkretną partię i ma dopuszczalne odchylenie. Zielnik pozwala porównać własne odczucia z tymi wartościami, ale nie zastępuje decyzji lekarza.',
    sources: [
      { title: 'Cannabigerol (CBG): A Comprehensive Review of Its Molecular Mechanisms and Therapeutic Potential (PMC)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11597810/' },
      { title: 'Pharmacological Aspects and Biological Effects of Cannabigerol and Its Synthetic Derivatives (PMC)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9666035/' },
      { title: 'Acute effects of cannabigerol on anxiety, stress, and mood: a double-blind, placebo-controlled, crossover, field trial (PMC)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11246434/' },
      { title: 'Cannabinol: przegląd (ScienceDirect Topics)', url: 'https://www.sciencedirect.com/topics/pharmacology-toxicology-and-pharmaceutical-science/cannabinol' },
    ],
  },
  {
    id: 'waporyzacja', title: 'Waporyzacja i temperatury',
    text: [
      'Waporyzacja polega na ogrzewaniu suszu do temperatury, w której kannabinoidy i terpeny przechodzą w parę, ale kwiat jeszcze się nie spala. Dzięki temu unika się dymu i części związków powstających przy spalaniu. Nie oznacza to, że inhalacja jest wolna od ryzyka: para też może podrażniać drogi oddechowe.',
      'W jednym z podstawowych badań nad waporyzatorem Volcano ustawiano temperatury około 130, 154 i 178 °C. Dobór temperatury jest kompromisem: w niższej uwalnia się mniej kannabinoidów, a w wyższej więcej pary, która bywa bardziej drażniąca. Dokładne wartości zależą od urządzenia, ilości suszu i stopnia rozdrobnienia, więc podane liczby traktuj jako orientacyjne.',
      'Waporyzatory mają różną konstrukcję (konwekcyjne, przewodzeniowe), a temperatura na wyświetlaczu nie zawsze pokrywa się z temperaturą suszu. Instrukcję urządzenia i zalecenia lekarza stawiaj ponad ogólnymi poradami.',
    ],
    list: [
      ['Rozdrobnienie', 'Równomierne, nie za drobne: zbyt drobny susz może zatykać urządzenie i szybciej tracić terpeny.'],
      ['Ilość', 'Zapisuj w Zielniku ilość i porę stosowania; dawkowanie ustalaj z lekarzem, a nie według temperatury ani „mocy” odmiany.'],
      ['Czyszczenie', 'Resztki żywicy zmieniają smak i przepływ powietrza; czyść urządzenie według instrukcji producenta.'],
      ['Sposób przyjmowania', 'Inhalacja, napar i inne formy mają różne zalety i ograniczenia; sposób stosowania ustala lekarz.'],
    ],
    after: 'Zielnik nie podaje zaleceń dawkowania. W razie niepokojących objawów po inhalacji (duszność, silny kaszel, kołatanie serca) przerwij stosowanie i skontaktuj się z lekarzem.',
    sources: [
      { title: 'Hazekamp A. i in. (2006): Evaluation of a vaporizing device (Volcano) for the pulmonary administration of tetrahydrocannabinol. J Pharm Sci 95(6):1308-17 (PubMed)', url: 'https://pubmed.ncbi.nlm.nih.gov/16637053/' },
      { title: 'Medicinal Cannabis: In Vitro Validation of Vaporizers for the Smoke-Free Inhalation of Cannabis (PMC)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4718604/' },
    ],
  },
  {
    id: 'przechowywanie', title: 'Przechowywanie suszu',
    text: [
      'Susz leczniczy to produkt roślinny. Z czasem THC powoli rozkłada się (m.in. do CBN), a lotne terpeny ulatniają się. Przyspieszają to światło (zwłaszcza UV), tlen, wysoka temperatura i wahania wilgotności.',
      'Ogólne zasady dla suszu leczniczego: szczelny pojemnik (najlepiej oryginalne opakowanie z apteki), z dala od światła, w chłodnym miejscu. W opracowaniach jako rozsądną granicę podaje się zwykle temperatury nieprzekraczające ok. 21 °C oraz umiarkowaną wilgotność względną, rzędu 60%. To wytyczne ogólne, a nie przepisy: w pierwszej kolejności stosuj się do ulotki i oznaczeń na opakowaniu.',
      'Zbyt wilgotny susz sprzyja pleśni, zbyt suchy staje się kruchy i traci aromat. Susz powinien być poza zasięgiem dzieci i zwierząt.',
    ],
    list: [
      ['Termin ważności', 'Wpisz go w Zielniku, aby dostać przypomnienie. Po terminie albo przy zapachu stęchlizny, widocznej pleśni lub wilgoci nie używaj suszu i zapytaj farmaceutę.'],
      ['Seria', 'Zapisz numer serii: przydaje się przy porównaniu partii i ewentualnym zgłoszeniu problemu z jakością.'],
      ['Transport', 'Nie zostawiaj opakowania w nagrzanym samochodzie ani na słońcu.'],
    ],
    after: 'Badania nad trwałością dotyczą głównie warunków laboratoryjnych i konkretnych produktów (m.in. konopi włóknistych). Tempo rozkładu zależy od odmiany, serii i warunków, więc liczby z poradników są orientacyjne.',
    sources: [
      { title: 'Effect of short-term storage on cannabinoid content of dried floral hemp (Cannabis sativa L) inflorescence (ScienceDirect)', url: 'https://www.sciencedirect.com/science/article/abs/pii/S2214786124000408' },
      { title: 'Long-term Storage and Cannabis Oil Stability (ResearchGate)', url: 'https://www.researchgate.net/publication/236170001_Long_-_term_Storage_and_Cannabis_Oil_Stability' },
      { title: 'Degradation and Storage of Therapeutic Cannabis (Cannapio)', url: 'https://www.cannapio.com/a/degradation-and-storage-of-therapeutic-cannabis' },
    ],
  },
  {
    id: 'interakcje', title: 'Interakcje z lekami (ogólnie)',
    text: [
      'Kannabinoidy, zwłaszcza CBD, są metabolizowane w wątrobie przez te same enzymy (rodzina cytochromu P450, m.in. CYP3A4, CYP2C9, CYP2C19), co wiele leków. W badaniach laboratoryjnych THC, CBD i CBN hamowały niektóre z tych enzymów, co teoretycznie może zmieniać stężenie innych leków we krwi.',
      'Opisano m.in. interakcję z warfaryną (w pojedynczych przypadkach wzrost wskaźnika INR i krwawienia) oraz z klobazamem, gdzie CBD znacząco podnosiło stężenie czynnego metabolitu. To przykłady, a nie pełna lista: znaczenie kliniczne interakcji zależy od dawki, sposobu podania i stanu pacjenta.',
      'Dodatkowo THC może nasilać działanie leków uspokajających, nasennych i alkoholu (senność, spowolnienie), a u niektórych osób wpływać na ciśnienie i tętno.',
    ],
    list: [
      ['Co zrobić', 'Poinformuj lekarza prowadzącego i farmaceutę o wszystkich stosowanych lekach, suplementach i ziołach, także tych bez recepty, zanim zaczniesz stosować susz lub zmienisz sposób jego stosowania.'],
      ['Leki o wąskim oknie terapeutycznym', 'Przy warfarynie, lekach przeciwpadaczkowych, immunosupresyjnych i niektórych przeciwdepresyjnych kontrola lekarska jest szczególnie ważna.'],
      ['Czego nie robić', 'Nie odstawiaj ani nie zmieniaj dawek innych leków na własną rękę.'],
    ],
    after: 'Ten artykuł jest przeglądem ogólnym i nie zastępuje konsultacji z lekarzem lub farmaceutą, który zna Twoje leki.',
    sources: [
      { title: 'Damkier P. i in. (2019): Interaction between warfarin and cannabis. Basic & Clinical Pharmacology & Toxicology', url: 'https://onlinelibrary.wiley.com/doi/10.1111/bcpt.13152' },
      { title: 'Papakyriakopoulou i in. (2026): Cannabinoids and drug-drug pharmacokinetic interactions: Deciphering the risks. Br J Clin Pharmacol', url: 'https://bpspubs.onlinelibrary.wiley.com/doi/10.1002/bcp.70430' },
      { title: 'Drug Interactions of Tetrahydrocannabinol and Cannabidiol in Cannabinoid Drugs (Deutsches Ärzteblatt, 2023)', url: 'https://di.aerzteblatt.de/int/archive/article/235523' },
    ],
  },
  {
    id: 'prawo-pacjenta', title: 'Prawo pacjenta w Polsce (stan na październik 2026)',
    text: [
      'To ogólne omówienie, a nie porada prawna. Przepisy się zmieniają, a część informacji pochodzi z serwisów dla pacjentów i kancelarii, nie z samych aktów prawnych, więc sprawdź aktualny stan u lekarza, w aptece lub w odpowiedniej instytucji.',
    ],
    list: [
      ['Recepta', 'Susz leczniczy wydawany jest w aptece na receptę na środki odurzające (kategoria Rpw). Według serwisów dla pacjentów recepta jest ważna 30 dni, a lekarz nie musi mieć konkretnej specjalizacji. O wskazaniach i dawkowaniu decyduje lekarz.'],
      ['Badanie osobiste', 'Od 7 listopada 2024 r. (rozporządzenie Ministra Zdrowia z 29 października 2024 r.) recepty na preparaty tego typu co do zasady wystawia się po osobistym zbadaniu pacjenta; zdalne wystawienie jest możliwe tylko w wyjątkowych sytuacjach, np. przy kontynuacji udokumentowanego leczenia. Szczegółowe wyjątki określa to rozporządzenie, więc zapytaj lekarza.'],
      ['Apteka', 'Nie każda apteka ma daną odmianę. Pod jedną nazwą rejestrową (np. „Tilray THC 22%”) mogą występować różne odmiany w kolejnych partiach, dlatego w Zielniku zapisuj odmianę i serię.'],
      ['Podróż w strefie Schengen', 'Art. 75 Konwencji wykonawczej do Układu z Schengen pozwala przewozić środki odurzające potrzebne do leczenia, jeśli podczas kontroli okaże się zaświadczenie wydane lub uwierzytelnione przez właściwy organ państwa pobytu. Według serwisów dla pacjentów w Polsce zaświadczenie wydaje wojewódzki inspektor farmaceutyczny, a jego ważność jest ograniczona. Zabierz też receptę, dowód zakupu i oryginalne opakowanie.'],
      ['Podróż poza Schengen', 'Obowiązują przepisy kraju docelowego i tranzytowego, a wiele państw zakazuje przewozu w ogóle. Sprawdź to w ambasadzie lub konsulacie przed wyjazdem.'],
      ['Prowadzenie pojazdów', 'Prowadzenie pojazdu pod wpływem środka odurzającego jest przestępstwem z art. 178a Kodeksu karnego. Według omówień prawniczych i klinicznych sama recepta nie wyłącza tej odpowiedzialności, a ocena zależy od okoliczności i opinii biegłego. Nie ustalono jednoznacznego wyjątku dla pacjentów ani nie zweryfikowano orzecznictwa, więc w razie wątpliwości skonsultuj się z lekarzem i prawnikiem. Po przyjęciu THC zdolność prowadzenia pojazdów może być osłabiona.'],
    ],
    after: 'W razie kontroli drogowej lub granicznej miej przy sobie receptę i dokumenty z leczenia.',
    sources: [
      { title: 'Prawo.pl: Lekarz przepisze medyczną marihuanę i fentanyl tylko po osobistym zbadaniu', url: 'https://www.prawo.pl/zdrowie/marihuana-medyczna-zniknie-z-receptomatow-przepisy-weszly-w-zycie,529919.html' },
      { title: 'Rynek Zdrowia: Od dziś rozporządzenie już w mocy: tych leków nie kupisz tak łatwo', url: 'https://www.rynekzdrowia.pl/Farmacja/Od-dzis-rozporzadzenie-juz-w-mocy-tych-lekow-nie-kupisz-tak-latwo,277696,6.html' },
      { title: 'Kancelaria DBS: Recepta na preparaty o działaniu uzależniającym jedynie po osobistym zbadaniu przez lekarza', url: 'https://kancelariadbs.pl/2024/12/02/recepta-na-preparaty-o-dzialaniu-uzalezniajacym-jedynie-po-osobistym-zbadaniu-przez-lekarza/' },
      { title: 'EUR-Lex: Konwencja wykonawcza do Układu z Schengen (akt 42000A0922(02)), art. 75', url: 'https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=celex:42000A0922(02)' },
      { title: 'Art. 178a Kodeksu karnego: prowadzenie pojazdu w stanie nietrzeźwości lub pod wpływem środka odurzającego', url: 'https://arslege.pl/prowadzenie-pojazdu-mechanicznego-w-stanie-nietrzezwosci-lub-pod-wplywem-srodka-odurzajacego/k1/a211/' },
      { title: 'Podróżowanie z medyczną marihuaną (EraKonopi.pl, serwis dla pacjentów)', url: 'https://erakonopi.pl/podrozowanie-z-medyczna-marihuana-co-musza-wiedziec-pacjenci-w-2025-roku,1641' },
    ],
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
      ['Cannabis flos', 'Łacińska nazwa suszu kwiatowego konopi, pod którą występuje w aptekach, np. „Cannabis flos Aurora THC 22%, CBD <1%”.'],
      ['Rpw', 'Kategoria recepty na środki odurzające i preparaty je zawierające; dotyczy suszu leczniczego z THC.'],
      ['Waporyzacja', 'Ogrzewanie suszu do temperatury uwalniającej kannabinoidy w postaci pary, bez spalania.'],
      ['CYP450', 'Rodzina enzymów wątrobowych metabolizujących wiele leków; kannabinoidy mogą na nie wpływać (patrz „Interakcje z lekami”).'],
      ['Nazwa rejestrowa', 'Urzędowa nazwa produktu w aptece (producent, % THC i CBD); jedna nazwa rejestrowa może obejmować kilka odmian handlowych.'],
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
