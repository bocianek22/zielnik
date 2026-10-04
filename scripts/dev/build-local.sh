#!/bin/bash
# Build z aliasem @neondatabase/serverless -> tests/db/neon-shim.mjs (lokalny PostgreSQL przez `pg`).
# Nie zmienia next.config.mjs: alias włącza zmienna ZIELNIK_LOCAL_PG=1. Użycie: scripts/dev/build-local.sh
set -e
cd "$(dirname "$0")/../.."
ZIELNIK_LOCAL_PG=1 npx next build
