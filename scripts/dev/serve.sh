#!/bin/bash
# Start `next start` w tle na porcie <port> z bazą <baza> (tworzy, jeśli brak). Wymaga wcześniejszego build-local.sh.
# Użycie: scripts/dev/serve.sh 4400 devtools   (PID w .dev/<port>.pid, log w .dev/<port>.log)
set -e
PORT=${1:?użycie: serve.sh <port> <baza>}; DB=${2:?użycie: serve.sh <port> <baza>}
cd "$(dirname "$0")/../.."
ADMIN=${PG_ADMIN_URL:-postgres://z:z@localhost/postgres}
BASE=${ADMIN%/*}
mkdir -p .dev
[ -f ".dev/$PORT.pid" ] && kill -0 "$(cat ".dev/$PORT.pid")" 2>/dev/null && { echo "port $PORT już obsługuje PID $(cat ".dev/$PORT.pid"); najpierw stop.sh $PORT" >&2; exit 1; }
service postgresql status >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1 || true
[ "$(psql "$ADMIN" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'")" = 1 ] || psql "$ADMIN" -qc "CREATE DATABASE \"$DB\""
export DATABASE_URL="$BASE/$DB"
export AUTH_SECRET=${AUTH_SECRET:-dev-secret-dev-secret-dev-secret-dev-secret-1234}
export BOCIAN_INITIAL_PASSWORD=${BOCIAN_INITIAL_PASSWORD:-bocian-start-1}
nohup npx next start -p "$PORT" > ".dev/$PORT.log" 2>&1 &
echo $! > ".dev/$PORT.pid"; echo "$DB" > ".dev/$PORT.db"
for _ in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/login" && break; sleep 1; done
echo "PID $(cat ".dev/$PORT.pid"), http://localhost:$PORT, baza $DB: $(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/login")"
