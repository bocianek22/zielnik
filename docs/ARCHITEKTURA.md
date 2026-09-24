# Architektura

## Stos
Next.js 15 (App Router) na Vercel, baza Neon (Postgres) przez `@neondatabase/serverless`, sesje w ciasteczku (`jose`), hasła `bcryptjs`. Testy: `npm test` (wbudowany runner Node, funkcje czyste w `tests/`) oraz kontrola statyczna `npm run check`. Błędy trafiają do tabeli `error_log` (`instrumentation.js`, `lib/errorlog.js`, panel admina).

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

## Zadania cykliczne (`vercel.json`)
Poniedziałek 05:00 UTC: aktualizacja katalogu · niedziela 03:00 UTC: migawka bazy.
