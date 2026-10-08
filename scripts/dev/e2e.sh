#!/bin/bash
# Testy E2E (tests/e2e/) albo, z argumentem `perf`, budżety Lighthouse (tests/perf/budgets.json): build z lokalnym PostgreSQL, serwer na wolnym porcie, świeża baza z danymi z seed.mjs, testy, stop.
# Użycie: npm run test:e2e | npm run test:perf   (zmienne: E2E_SKIP_BUILD=1 pomija build, E2E_PORT, E2E_DB, PG_ADMIN_URL jak w serve.sh;
# E2E_SHOTS=katalog zrzutów z nieudanych testów, domyślnie zrzuty/e2e; E2E_KEEP=1 zostawia serwer po testach)
set -e
cd "$(dirname "$0")/../.."
PORT=${E2E_PORT:-$(node -e "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})")}
DB=${E2E_DB:-zielnik_e2e_$PORT}
ADMIN=${PG_ADMIN_URL:-postgres://z:z@localhost/postgres}
[ "$E2E_SKIP_BUILD" = 1 ] && [ -d .next ] || scripts/dev/build-local.sh > .dev-build.log 2>&1 || { tail -40 .dev-build.log; exit 1; }
rm -f .dev-build.log
service postgresql status >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1 || true
psql "$ADMIN" -qc "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" >/dev/null
cleanup() {
  [ "$E2E_KEEP" = 1 ] && { echo "serwer zostaje: http://localhost:$PORT (stop: scripts/dev/stop.sh $PORT)"; return; }
  scripts/dev/stop.sh "$PORT" >/dev/null
  psql "$ADMIN" -qc "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" >/dev/null 2>&1 || true
}
trap cleanup EXIT
# KON-1: wysyłka e-maili włączona, z atrapą API Resend na 127.0.0.1 (tests/e2e/email.test.mjs); linki na adres serwera testowego
MAIL_PORT=${E2E_MAIL_PORT:-$(node -e "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})")}
export E2E_MAIL_PORT=$MAIL_PORT RESEND_API_KEY=e2e MAIL_FROM='Notatnik <notatnik@example.test>' MAIL_API_URL="http://127.0.0.1:$MAIL_PORT/emails" APP_URL="http://localhost:$PORT"
scripts/dev/serve.sh "$PORT" "$DB"
node scripts/dev/seed.mjs "$DB" --port "$PORT" | tail -1
export E2E_BASE="http://localhost:$PORT" E2E_SHOTS="${E2E_SHOTS:-zrzuty/e2e}"
rm -rf "$E2E_SHOTS"
if [ "$1" = perf ]; then
  node scripts/dev/lighthouse.mjs --port "$PORT"
else
  node --test --test-concurrency=1 tests/e2e/*.test.mjs
fi
