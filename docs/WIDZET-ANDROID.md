# POM-13: widżet Androida „Zapas i Zużyłem” (projekt, 8.10)

Projekt przygotowany przez przegląd Opus przed wdrożeniem. Stan: do wdrożenia po fali 4 (`docs/PLAN-PAZDZIERNIK.md`).

## Decyzja: strona przekazuje dane do telefonu, bez nowego API (wariant B)
- Strona przy każdym otwarciu zapisuje przez własną wtyczkę Capacitor do SharedPreferences tylko datę końca zapasu (`until`) i znacznik czasu. Widżet sam odlicza dni, bez sieci i bez WorkManagera.
- Odrzucone: token urządzenia z `GET /api/widget` (wariant A: nowe trwałe poświadczenie na telefonie, nakład L) i sam przycisk (wariant C: bez wartości „Starczy na N dni”). Projekt wariantu A, gdyby był potrzebny:
  - tabela `widget_tokens` z SHA-256 tokenu i `sv` = `users.session_version`;
  - limit 12 na godzinę, odpowiedź `{until}` z `no-store`;
  - tabela poza eksportem i kopią.
- **Ryzyka i jak je ograniczamy:**
  - **Telefon bez blokady ekranu:** obcy widzi najwyżej jedną neutralną liczbę.
  - **Kopia zapasowa Androida:** już wyłączona (`allowBackup=false`, `data_extraction_rules.xml`, test manifestu).
  - **Wylogowanie i zmiana konta:** czyszczenie widżetu w `LogoutButton.js`, `WebLock.js` (automatyczne wylogowanie), `ProfileForm.js` (usunięcie konta), `markFreshLogin` (zmiana konta) i na `/login`.
  - **Nieaktualne dane:** starsze niż 7 dni widżet pokazuje jako „–”.
  - **Ryzyko szczątkowe:** po zmianie hasła lub „wyloguj wszędzie” z innego urządzenia liczba zostaje do najbliższego otwarcia aplikacji.

## Decyzje domyślne (do zmiany przez właściciela)
1. **Przy włączonej blokadzie PIN/biometrią:** sam przycisk, bez liczby.
2. **Treść:** bez nazw odmian i bez słów „konopie”/„Zielnik”. Lista widżetów w systemie i tak pokazuje nazwę aplikacji.
3. **Liczenie zapisów z widżetu:** nie w wersji 1.

## Kod
- **Natywny (Java + RemoteViews; projekt nie ma Kotlina, więc bez Glance):**
  - `mobile/android/app/src/main/java/pl/zielnik/app/StockWidget.java`: `AppWidgetProvider`; czyta prefs `zielnik_widget` (`until`, `updatedAt`, `locked`) i pokazuje „Starczy na N dni”, „Sprawdź zapas” albo „–”.
  - `WidgetDays.java`: czysta funkcja liczenia N (test JUnit).
  - `WidgetPlugin.java`: `@CapacitorPlugin(name="ZielnikWidget")` z `set({until, locked})` i `clear()`; rejestracja w `MainActivity` jak `PrintPlugin`.
  - `res/layout/widget_stock.xml`, `res/xml/widget_info.xml`: rozmiar 2×1, tylko `home_screen`, `updatePeriodMillis` 3 h.
  - Napisy: „Zapas”, „Zapisz”, „Otwórz”.
  - Manifest: receiver z `APPWIDGET_UPDATE`, bez nowych uprawnień.
  - Dotknięcia przez `PendingIntent.getActivity` na jawny `MainActivity` (`FLAG_IMMUTABLE`, osobne `requestCode`), ścieżka przez istniejące `EXTRA_PATH`: przycisk `/?zuzylem=1`, treść `/`. `SAFE_PATH` sprawdza ścieżkę, a `NativeLock` zawsze wymaga odblokowania.
- **Strona:**
  - `lib/widget.js`: `widgetPayload({stock, dailyUse, today})` zwraca `{until|null}`, minimum z prognoz g i ml. Ta sama funkcja liczy prognozę w `TodayPanel`.
  - `bridge.js`: `widgetSet` i `widgetClear`; bez wtyczki (starsze APK, iOS, przeglądarka) nic nie robią.
  - Wywołania: przy wczytaniu `TodayBoard`, po „Zużyłem” i w `setLockEnabled`.

## Testy
- **Automatyczne:**
  - `tests/widget.test.js`: g, ml, oba, brak zużycia, zapas 0; tylko klucz `until`.
  - `tests/shortcuts.test.js`: ścieżka widżetu w `SHORTCUT_PATHS` i `SAFE_PATH`.
  - `tests/android-manifest.test.js`: receiver, `home_screen`, brak nowych uprawnień, brak „konop”/„Zieln” w zasobach widżetu.
  - Opcjonalnie `testDebugUnitTest` w `.github/workflows/mobile-android.yml`.
- **Ręcznie na telefonie:**
  - dodanie widżetu, motyw jasny i ciemny, rozmiary;
  - zimny start z blokadą: jedno okno biometrii, potem „Zużyłem”;
  - wylogowanie, zmiana hasła, usunięcie konta;
  - zmiana daty, dane starsze niż 7 dni, restart, ponowna instalacja.

## Etapy (każdy z commitem i kontrolami)
1. `lib/widget.js` z testami i podpięcie w `TodayPanel`, bez zmiany zachowania.
2. `bridge.js`, wywołania i czyszczenie we wszystkich miejscach powyżej.
3. Java, zasoby, manifest, rejestracja wtyczki, build APK w CI.
4. Testy manifestu i ścieżek, `mobile/README.md` (lista kontrolna), `mobile/package.json` 0.4.0, CHANGELOG, HANDOFF.
