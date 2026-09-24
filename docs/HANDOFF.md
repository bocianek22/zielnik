# Przekazanie prac (dla kolejnego programisty i Claude)

Aktualizuj ten plik przy każdym wydaniu. Sekcja „Następne kroki” ma zawsze odpowiadać stanowi projektu.

## 1. Stan projektu
- Aplikacja **Zielnik**: dziennik odmian medycznej konopi dla pacjentów (Next.js 15 na Vercel, baza Neon Postgres). Zamknięta beta, rejestracja z kodem zaproszenia.
- Bieżąca wersja: patrz `package.json` i `CHANGELOG.md`. Kod: GitHub `bocianek22/zielnik`, hosting: projekt Vercel `zielnik`.
- Konto admina: `Bocian`. Ustawienia (zmienne środowiskowe) opisuje `docs/ARCHITEKTURA.md`.
- Dokumenty: `ROADMAP.md` (plan wg działów i wersji), `CHANGELOG.md`, `CONTRIBUTING.md` (commity, wersje, wydania), `docs/ARCHITEKTURA.md`.

## 2. Jak zacząć nową rozmowę z Claude
1. Na GitHubie: Code → Download ZIP. Wgraj ten plik do rozmowy.
2. Wklej prompt startowy (niżej).
3. Claude pracuje w piaskownicy bez dostępu do sieci: nie zainstaluje pakietów npm, nie połączy się z bazą i nie wdroży aplikacji. Zwraca paczkę ZIP ze zmianami, a Ty wgrywasz ją na GitHub (Add file → Upload files).

**Prompt startowy (do wklejenia):**
> Kontynuujemy projekt „Zielnik” (Next.js + Neon, repozytorium w załączonym ZIP-ie). Przeczytaj `docs/HANDOFF.md`, `ROADMAP.md`, `CHANGELOG.md`, `CONTRIBUTING.md` i `docs/ARCHITEKTURA.md`. Zasady: odpowiadaj po polsku; małe, bezpieczne kroki; po każdej zmianie uruchom `node scripts/check.js` i `npm test`; zaktualizuj `CHANGELOG.md`, podnieś wersję w `package.json` i sekcję „Następne kroki” w `docs/HANDOFF.md`; oddaj paczkę `zielnik-vX.Y.Z.zip` zawierającą wyłącznie pliki zmienione od poprzedniego wydania (zachowaj ścieżki katalogów) oraz sugerowany komunikat commita w formacie Conventional Commits. Na końcu każdej odpowiedzi podaj krótko następne kroki. Zaczynamy od: [wpisz zadanie z ROADMAP, np. MOB-3].

## 3. Zasady pracy (skrót)
- Paczka zawiera tylko zmienione pliki od ostatniego **potwierdzonego** wgranego wydania. Gdy nie wiadomo, co jest wgrane, zrób paczkę zbiorczą od ostatniego potwierdzonego stanu.
- Po wgraniu: Vercel → Deployments (status READY), potem logi runtime i sekcja „Dziennik błędów” w panelu admina.
- Zmiany bazy tylko addytywne i idempotentne w `lib/db.js` (`ensureDb`).

## 4. Pułapki (wyciągnięte wnioski)
- **Kontrola składni (esbuild) NIE wykrywa literówki `(x) = wartość` zamiast `(x) => wartość`** - to poprawny JS (przypisanie do zmiennej), tylko błędny semantycznie, i wybucha dopiero w runtime jako `ReferenceError: x is not defined`. Po każdej automatycznej edycji funkcji strzałkowych sprawdzaj: `grep -nE "\([a-zA-Z_]+\) = [^=>]" plik` (bez `=>` i bez `==`).
- Gdy użytkownik zgłasza błąd z kodem: najpierw sprawdź Vercel -> Deployments (czy w ogóle powstał nowy deploy) i logi runtime konkretnego `deploymentId` - to daje dokładny stack trace zamiast zgadywania.
- Bez `npm install` (brak sieci w piaskownicy) nie da się uruchomić prawdziwego lintera (`eslint` z regułą `no-undef`) - `scripts/check.js` i `esbuild --loader=jsx` łapią tylko część błędów (patrz punkt wyżej).
- Przy dodawaniu stanu (`useState`) do pliku najpierw sprawdź `grep -n "useState(" plik`, żeby nie zadeklarować dwa razy tej samej nazwy (zdarzyło się z `limit` w `StrainsBoard.js`, 0.19.0).
- Ta paczka (`zielnik-v0.22.1.zip`) zawiera **skumulowane zmiany od v0.17.0** (ostatniej wersji, o której wiadomo, że została wgrana): 0.17.1, 0.18.0, 0.19.0, 0.20.0, 0.21.0, 0.22.0, 0.22.1. Wgraj ją w całości.
- Po wgraniu: na telefonie kliknij „Dodaj odmianę” i sprawdź, czy arkusz zajmuje cały ekran, pasek u góry jest przyklejony, a „← Wróć” zamyka formularz bez zapisu.
- Po wgraniu 0.21.0: przełącz tryb ciemny na telefonie i na komputerze, sprawdź kontrast tekstu na kartach, plakietkach i w formularzach — zgłoś, co jest nieczytelne (kolory łatwo poprawić w `:root[data-theme="dark"]` w `app/globals.css`).
- Po wgraniu 0.20.0 sprawdź w Vercel, czy `/sw.js` i `/offline.html` są dostępne publicznie (folder `public/`, bez logowania) — inaczej offline nie zadziała.
- Zdjęcia otwieraj komponentem `app/components/Lightbox.js` (pełny ekran, przycisk ×), nigdy linkiem `target="_blank"` do pliku obrazu — na telefonie nie ma jak z tego wrócić.
- **Brakujący plik po wgraniu** psuje stronę (były przypadki `knowledge.js`, `dailyUse`). `node scripts/check.js` wykrywa brakujące pliki i eksporty. Uruchamiaj zawsze.
- W `app/api/**/route.js` nie eksportuj niczego poza metodami HTTP i opcjami Next.js (skrypt kontrolny to sprawdza).
- Przebudowując plik, nie kasuj cudzych funkcji: po zmianie sprawdź listę eksportów (`grep -n "^export" plik`).
- Widoczność treści (`can_see` w `lib/db.js` i `lib/strains.js`) wpływa na całą aplikację. Każda zmiana wymaga ręcznego testu na dwóch kontach (znajomi, blokada).
- W zapytaniach `INSERT ... SELECT` z parametrami dodawaj rzutowania (`::int`, `::numeric`), inaczej PostgreSQL zgłosi błąd typu.
- Wszystkie zapytania SQL były pisane bez uruchomienia. Nowe funkcje testuj po wgraniu i patrz w „Dziennik błędów”.
- Nowa treść użytkownika = zapis w eksporcie danych (`app/api/account/export`), kopii zapasowej (`lib/backup.js`) i uwzględnienie w `can_see`.
- Dolny pasek i górne menu mają zduplikowaną listę pozycji (`BottomNav.js`, `Header.js`), zmieniaj oba (MOB-17).

## 5. Decyzje i zadania po stronie właściciela
- Zakup domeny, potem usługa e-mail (odzyskiwanie hasła), konta Google i Apple do logowania.
- Konsultacja z prawnikiem (RODO, reklama produktów leczniczych i aptek) i księgowym; przegląd regulaminu i polityki prywatności.
- Wybór bramki płatności i platformy wpłat (`DONATE_URL`), decyzja o `PREMIUM_ENFORCED`.
- Źródło danych do katalogu (`CATALOG_FEED_URL`), plan Vercel Pro przy działalności komercyjnej.

## 6. Następne kroki (aktualne dla wersji 0.22.1)
0. **Włączyć podpowiedzi z internetu:** w Vercel dodać `ANTHROPIC_API_KEY` (klucz z konsoli Anthropic) i zrobić redeploy. Przetestować na kilku odmianach, sprawdzić źródła i koszt zapytań (limit 15 dziennie na użytkownika, cache 90 dni).
1. **Sprawdzić wersję mobilną na telefonie** (iOS i Android): dolny pasek, arkusz „Więcej”, tryb ciemny, formularze. Zgłosić uwagi jako zadania.
2. **Mobile, część 3** (`ROADMAP.md`, sekcja 11): MOB-10 lżejsze dane listy (zmiana zapytania SQL w `lib/strains.js::listStrains` — **celowo odłożone, wymaga testu na koncie z wieloma znajomymi przed wdrożeniem, nie robić bez możliwości uruchomienia**), MOB-6 formularze w arkuszach, dokończenie MOB-8 (offline z danymi, monit instalacji). Zrobione: MOB-3, MOB-4, MOB-5 (0.19.0), szkielety i leniwe ładowanie (0.20.0), tryb ciemny na zmiennych CSS (0.21.0).
3. **0.16.x**: testy funkcji SQL `can_see` i integracyjne API na gałęzi bazy Neon (PLA-1), alerty o błędach (PLA-2).
4. **Po zakupie domeny**: KON-1 e-mail i odzyskiwanie hasła, KON-3 Google, potem Apple i płatności.
5. Utrzymywać `CHANGELOG.md` i tę sekcję na bieżąco.
