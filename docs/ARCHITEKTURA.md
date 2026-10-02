# Architektura

## Stos
Next.js 15 (App Router) na Vercel, baza Neon (Postgres) przez `@neondatabase/serverless`, sesje w ciasteczku (`jose`), hasła `bcryptjs`. Testy: `npm test` (wbudowany runner Node, funkcje czyste w `tests/`), `npm run test:db` (integracyjne z lokalnym PostgreSQL w `tests/db/`: sterownik Neon podmieniony na `pg`, trasy API wywoływane bezpośrednio) oraz kontrola statyczna `npm run check`. CI: `.github/workflows/ci.yml`. Błędy trafiają do tabeli `error_log` (`instrumentation.js`, `lib/errorlog.js`, panel admina).

## Struktura
- `app/`: strony (serwerowe) i komponenty klienckie, trasy API w `app/api/**/route.js`.
- `lib/`: logika i dostęp do danych (`db.js` tworzy schemat i migracje, `strains.js` zapytania o odmiany, `visibility.js`, `effects.js`, `plans.js`, `ratelimit.js`, `backup.js`, `catalog.js`).
- `scripts/check.js`: kontrola projektu; `.github/workflows/`: CI i wydania; `vercel.json`: zadania cykliczne.

## Model danych (skrót)
`users` (profil, plan, zgody) · `strains`, `user_strain` (wpisy osobiste: ocena, opinia, stan, odczucia, widoczność) · `user_pool` (do wykupienia wg puli) · `usage_log`, `purchases`, `prescriptions`, `symptom_log` · `strain_tests`, `strain_photos` · `friendships`, `groups`, `group_members`, `blocks`, `reports` · `invites`, `rate_limits`, `backups` · `market_catalog`, `options` · `push_subscriptions` (urządzenia: `kind` = `webpush`, później `fcm`/`apns`), `push_prefs` (ustawienia przypomnień), `push_sent` (co wysłano danego dnia).

## Prywatność
Funkcja SQL `can_see(viewer, owner, visibility)` decyduje o dostępie (tylko ja, znajomi, znajomi znajomych, wszyscy zalogowani; blokada działa w obie strony). Stany, zakupy, zużycie, recepty i objawy są zawsze prywatne. Każda nowa treść użytkownika musi przechodzić przez `can_see` i trafić do eksportu oraz kopii zapasowej.

## Zmienne środowiskowe
`DATABASE_URL` (baza), `AUTH_SECRET` (sesje), `BOCIAN_INITIAL_PASSWORD` (hasło startowe admina), `CRON_SECRET` (zadania cykliczne), `CATALOG_FEED_URL` (źródło katalogu), `DONATE_URL` (wpłaty), `PREMIUM_ENFORCED=1` (włącza płatny plan), `ANTHROPIC_API_KEY` (podpowiedzi z internetu; bez klucza funkcja zwraca komunikat o braku konfiguracji), `ANTHROPIC_MODEL` (opcjonalnie, domyślnie `claude-haiku-4-5-20251001`), `SUGGEST_DOMAINS` (opcjonalnie, lista serwisów oddzielona przecinkami), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (powiadomienia push; para kluczy z `node scripts/vapid-keys.js`, subject np. `mailto:adres`; bez nich funkcja jest wyłączona), `PUSH_CRON_HOURLY=1` (opcjonalnie, gdy `/api/cron/reminders` jest wywoływany co godzinę - wtedy działa godzina wybrana przez użytkownika).

## Zadania cykliczne (`vercel.json`)
Poniedziałek 05:00 UTC: aktualizacja katalogu · niedziela 03:00 UTC: migawka bazy · codziennie 07:00 UTC (9:00 latem, 8:00 zimą w Polsce): przypomnienia push (`lib/push.js`; Vercel Hobby pozwala na cron najwyżej raz dziennie).

## Powiadomienia push (PAC-3)
Web Push z VAPID (`web-push`, tylko środowisko Node). Przeglądarka zapisuje subskrypcję przez `/api/push/subscription` (dozwolone tylko adresy znanych usług push), cron `/api/cron/reminders` wysyła jedno zbiorcze powiadomienie na użytkownika: recepta ważna jeszcze 0-7 dni z niewykorzystanymi gramami, zapas na ≤ N dni wg średniego zużycia z 30 dni. Domyślnie treść bez szczegółów („Masz 2 przypomnienia”), bo widać ją na ekranie blokady; nazw odmian nie ma nigdy. Subskrypcje z 404/410 są usuwane, po 30 kolejnych innych błędach także. Endpointy nie trafiają do eksportu ani kopii (klucze urządzeń); wylogowanie wyłącza push na danym urządzeniu.
