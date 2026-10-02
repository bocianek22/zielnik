# Architektura

## Stos
Next.js 15 (App Router) na Vercel, baza Neon (Postgres) przez `@neondatabase/serverless`, sesje w ciasteczku (`jose`), hasła `bcryptjs`. Testy: `npm test` (wbudowany runner Node, funkcje czyste w `tests/`), `npm run test:db` (integracyjne z lokalnym PostgreSQL w `tests/db/`: sterownik Neon podmieniony na `pg`, trasy API wywoływane bezpośrednio) oraz kontrola statyczna `npm run check`. CI: `.github/workflows/ci.yml`. Błędy trafiają do tabeli `error_log` (`instrumentation.js`, `lib/errorlog.js`, panel admina).

## Struktura
- `app/`: strony (serwerowe) i komponenty klienckie, trasy API w `app/api/**/route.js`.
- `lib/`: logika i dostęp do danych (`db.js` tworzy schemat i migracje, `strains.js` zapytania o odmiany, `visibility.js`, `effects.js`, `plans.js`, `ratelimit.js`, `backup.js`, `catalog.js`).
- `scripts/check.js`: kontrola projektu; `.github/workflows/`: CI i wydania; `vercel.json`: zadania cykliczne.

## Model danych (skrót)
`users` (profil, plan, zgody) · `strains`, `user_strain` (wpisy osobiste: ocena, opinia, stan, odczucia, widoczność) · `user_pool` (do wykupienia wg puli) · `usage_log`, `purchases`, `prescriptions`, `symptom_log` · `strain_tests`, `strain_photos` · `friendships`, `groups`, `group_members`, `blocks`, `reports` · `invites`, `rate_limits`, `backups` · `market_catalog`, `options`.

## Prywatność
Funkcja SQL `can_see(viewer, owner, visibility)` decyduje o dostępie (tylko ja, znajomi, znajomi znajomych, wszyscy zalogowani; blokada działa w obie strony). Stany, zakupy, zużycie, recepty i objawy są zawsze prywatne. Każda nowa treść użytkownika musi przechodzić przez `can_see` i trafić do eksportu oraz kopii zapasowej.

## Zmienne środowiskowe
`DATABASE_URL` (baza), `AUTH_SECRET` (sesje), `BOCIAN_INITIAL_PASSWORD` (hasło startowe admina), `CRON_SECRET` (zadania cykliczne), `CATALOG_FEED_URL` (źródło katalogu), `DONATE_URL` (wpłaty), `PREMIUM_ENFORCED=1` (włącza płatny plan), `ANTHROPIC_API_KEY` (podpowiedzi z internetu; bez klucza funkcja zwraca komunikat o braku konfiguracji), `ANTHROPIC_MODEL` (opcjonalnie, domyślnie `claude-haiku-4-5-20251001`), `SUGGEST_DOMAINS` (opcjonalnie, lista serwisów oddzielona przecinkami).
`BLOB_READ_WRITE_TOKEN` (kopie zapasowe poza bazą; Vercel ustawia go sam po podłączeniu do projektu **prywatnego** magazynu Blob; bez niego migawki trafiają do tabeli `backups` w tej samej bazie), `BACKUP_ENCRYPTION_KEY` (opcjonalnie, 32 bajty w base64, np. `openssl rand -base64 32`; włącza szyfrowanie AES-256-GCM kopii w Blob).

## Kopie zapasowe
Co niedzielę (cron) i na żądanie z panelu admina `lib/backup.js` zrzuca do JSON-a **wszystkie** tabele schematu `public` z wyjątkiem `rate_limits`, `backups`, `schema_meta`, `strain_suggestions` (tymczasowe/cache) i `strain_photos` (zdjęcia base64, zbyt duże); z `users` wycinane są `password_hash` i `avatar`, ze `strain_tests` kolumna `data` (lista w `BACKUP_EXCLUDED` / `BACKUP_STRIP`). Nowa tabela trafia do kopii sama, bez zmian w kodzie.
- **Bez `BLOB_READ_WRITE_TOKEN`:** JSON w tabeli `backups`, 8 najnowszych (utrata bazy = utrata kopii).
- **Z tokenem:** plik `zielnik-backups/<data>-<auto|reczna>.json.gz` (gzip, z `BACKUP_ENCRYPTION_KEY` dodatkowo `.enc`) w prywatnym Vercel Blob (`access: 'private'`; odczyt wymaga tokenu, więc pobranie idzie przez `/api/backup?id=N`, tylko admin). W `backups` zostają metadane (`kind`, `size`, `blob_path`, `data = ''`). Retencja: 12 tygodni (usuwane pliki i ich wiersze). Błąd zapisu do Blob przerywa zadanie (widać w logach crona), bez cichego powrotu do bazy.
- **Format `.enc`** (`lib/backup-pack.js`): `ZBK1` (4 B, także AAD) + iv (12 B) + tag GCM (16 B) + szyfrogram z gzip(JSON).
- **Odtworzenie:** pobierz plik z panelu admina (albo z konsoli Vercel Blob), potem lokalnie `BACKUP_ENCRYPTION_KEY=<klucz> node --experimental-default-type=module scripts/backup-decrypt.js zielnik-kopia-RRRR-MM-DD.json.gz.enc kopia.json` (dla pliku niezaszyfrowanego klucz jest zbędny). Wynik to obiekt `{ createdAt, <tabela>: [wiersze] }`; import do bazy jest ręczny (`INSERT ... SELECT * FROM jsonb_populate_recordset(NULL::tabela, ...)`). Klucz trzymaj poza Vercel (menedżer haseł): bez niego kopie `.enc` są nie do odczytania, a zmiana klucza nie dotyczy kopii już zapisanych.

## Zadania cykliczne (`vercel.json`)
Poniedziałek 05:00 UTC: aktualizacja katalogu · niedziela 03:00 UTC: migawka bazy.
