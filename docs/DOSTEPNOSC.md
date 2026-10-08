# Dostępność (WCAG 2.2 AA)

Zakres: UX-2 w `ROADMAP.md`, POM-21 i POM-22 w `docs/POMYSLY.md`. Stan z fali 2 (przed 1.0).

## Co sprawdzają testy (CI, `npm run test:e2e`)
- `tests/e2e/dostepnosc.test.mjs`: `@axe-core/playwright` (tagi wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) na `/`, `/dziennik`, `/obserwacje`, `/raport`, `/recepty`, `/historia`, `/profil`, `/katalog`, `/strains/[id]` w motywie jasnym, ciemnym i w trybie „duże cele”, oraz `/login` w obu motywach. Test pada na naruszeniach serious i critical (w tym kontrast).
- Ten sam plik: rozmiar głównych kontrolek (przyciski, linki, pola, role button/radio/switch) na `/`, `/dziennik`, `/profil`, `/katalog`: co najmniej 44 px, w trybie „duże cele” 56 px. Wyjątki: linki w ciągłym tekście (WCAG 2.5.8), suwaki i pola wyboru z etykietą o pełnym rozmiarze.
- `tests/e2e/klawiatura.test.mjs`: arkusz „Więcej” (axe z otwartym arkuszem w obu motywach, Tab nie ucieka z arkusza, Escape zamyka, fokus wraca na „Więcej”), ustawienie „Większy tekst i przyciski” (zapis na urządzeniu, klasa już w pierwszym dokumencie), `prefers-reduced-motion`.
- Ręczny przegląd poza testem (axe z regułami best-practice, 16 ekranów w obu motywach, także `/szukaj`, `/wiedza`, `/znajomi`, `/compare`, `/rankings`, `/wheel`, `/import`): 0 naruszeń.

## Co zmieniono
- „Większy tekst i przyciski” (profil, sekcja Wygląd): `localStorage` `zielnik.big`, klasa `big-ui` na `<html>` ustawiana skryptem startowym z nonce (bez migania), skala 125% rozmiaru bazowego (typografia jest w `rem`, więc skaluje się też od systemowego rozmiaru czcionki), cele 56 px, większe przełączniki, wiersze, dolny pasek. Stałe 16 px w polach zamieniono na `1rem`.
- `app/components/useFocusTrap.js`: wspólna pułapka fokusu (Tab krąży, Escape, powrót fokusu) dla blokady PIN w przeglądarce (`WebLock`), ekranu blokady aplikacji (`NativeShell`), podglądu zdjęcia (`Lightbox`), arkusza „Więcej” i menu „+” (`BottomNav`) oraz pełnoekranowego formularza odmiany na telefonie (`FormSheet` w `StrainsBoard`; bez Escape, żeby nie gubić wpisanych danych).
- Skala odczuć: tabela `sr-only` z wartościami (wykres radarowy miał tylko nazwę), `aria-valuetext` suwaków przy braku oceny, kolory wykresu z tokenów (tryb ciemny).
- `prefers-reduced-motion`: dodatkowo `scroll-behavior: auto` i brak płynnego przewijania po „Dodaj odmianę”.
- Napis w konsoli (CSP blokowało preload skryptu z `next/dynamic` bez nonce) na `/strains/[id]`, `/wheel`, `/rankings`: komponenty importowane statycznie (kilka KB).

## Wykresy (tekstowa alternatywa)
Panel „Dziś” (opis i `aria-live`), `UsageChart` (tabela `sr-only`, nawigacja strzałkami), wykres objawów (kreska, kształt, tabela, 0.33.0), historia (opis `aria-label`), radar odczuć (tabela, nowość).

## Zostaje ręcznie (telefon)
- TalkBack (Android) i VoiceOver (iOS): kolejność czytania w arkuszu „Więcej”, blokadzie PIN i formularzu odmiany; ogłaszanie komunikatów po zapisie („Cofnij”); suwaki objawów i odczuć.
- Systemowy rozmiar czcionki 130-200% razem z „Większy tekst i przyciski” na 320 px (brak poziomego przewijania, nakładania się tekstu w dolnym pasku).
- Przełączanie ekranu w aplikacji natywnej (WebView): fokus po otwarciu ekranu blokady.
- Drżenie rąk: czy 56 px wystarcza, czy potrzebny jest odstęp między celami.

## Do decyzji lub poza zakresem tej fali
- `app/components/StrainForm.js`, `lib/strains.js`, `app/admin/**` nie były ruszane (praca równoległa). Do sprawdzenia po scaleniu: formularz odmiany jest `position: fixed` na telefonie bez własnej roli dialogu (tu ratuje go `FormSheet`), panele admina nie były skanowane axe.
- Menu „+” ma `role="menu"` bez nawigacji strzałkami (Tab działa); rozważyć zwykłą listę przycisków.
