# Zielnik: zasady dla Claude

Dziennik odmian medycznej konopi. Next.js 15 (App Router, JavaScript, bez TypeScriptu) na Vercel, Neon Postgres przez `@neondatabase/serverless` (szablon `sql()\`...\``), sesje JWT (`jose`) w ciasteczku. Szczegóły: `docs/ARCHITEKTURA.md`, plan: `ROADMAP.md`, `docs/PRZEGLAD-2026-10.md`, stan i następne kroki: `docs/HANDOFF.md`.

## Zasady
- Odpowiedzi, komentarze w kodzie, komunikaty dla użytkownika i dokumentacja po polsku. Styl kodu jak w otoczeniu (zwięzły, komentarze tylko tam, gdzie wyjaśniają "dlaczego").
- Zmiany bazy tylko addytywne i idempotentne w `lib/db.js` (`ensureDb`): `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.
- Trasy API: `safe()` + `requireUser()` z `lib/guard.js`, identyfikatory z adresu przez `intId()`. W `route.js` eksportuj tylko metody HTTP i opcje Next.js.
- Każda nowa treść użytkownika: widoczność przez `can_see`, eksport (`app/api/account/export`), kopia (`lib/backup.js`).
- Każda zmiana SQL lub uprawnień = przypadek testowy w `tests/db/` (własny plik `tests/db/<obszar>.test.js`, wzór w `api.test.js`).
- Wydanie: wpis w `CHANGELOG.md`, wersja w `package.json`, sekcja „Następne kroki” w `docs/HANDOFF.md`, w razie potrzeby `ROADMAP.md`.

## Kontrole przed commitem
```
npm run check && npm test && npm run build
TEST_DATABASE_URL=postgres://z:z@localhost/<własna_baza> npm run test:db   # lokalny PostgreSQL, baza jest czyszczona
```
Lokalny PostgreSQL w sesji chmurowej: `service postgresql start`, użytkownik `z`/`z` (superuser); własną bazę utwórz przez `psql postgres://z:z@localhost/postgres -c 'CREATE DATABASE nazwa'`.
