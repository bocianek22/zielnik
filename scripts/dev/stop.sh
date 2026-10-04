#!/bin/bash
# Zatrzymuje serwer uruchomiony przez serve.sh na porcie <port>: tylko zapisany PID i jego potomkowie (bez pkill).
# Czyści rate_limits w bazie serwera, żeby kolejne logowania nie trafiły na limit. Użycie: scripts/dev/stop.sh 4400
PORT=${1:?użycie: stop.sh <port>}
cd "$(dirname "$0")/../.."
PIDF=".dev/$PORT.pid"
[ -f "$PIDF" ] || { echo "brak $PIDF"; exit 0; }
PID=$(cat "$PIDF")
# `next start` uruchamia proces potomny next-server: zbieramy potomków PID-u i zatrzymujemy tylko ich
kids() { for c in $(pgrep -P "$1"); do kids "$c"; echo "$c"; done; }
ALL="$(kids "$PID") $PID"
kill $ALL 2>/dev/null
for _ in $(seq 1 10); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
if [ -f ".dev/$PORT.db" ]; then
  ADMIN=${PG_ADMIN_URL:-postgres://z:z@localhost/postgres}
  psql "${ADMIN%/*}/$(cat ".dev/$PORT.db")" -qc 'DELETE FROM rate_limits' >/dev/null 2>&1 || true
fi
rm -f "$PIDF" ".dev/$PORT.db"
echo "zatrzymano $ALL"
