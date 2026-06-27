#!/bin/sh
set -e

DATA_DIR="/app/data"
DB_FILE="$DATA_DIR/emdash.db"
UPLOADS_DIR="$DATA_DIR/uploads"
EMDASH_CLI="./node_modules/emdash/dist/cli/index.mjs"

mkdir -p "$DATA_DIR" "$UPLOADS_DIR"

# The server runs schema migrations automatically on first request. We only need
# to load the starter content from seed/seed.json, and only on a fresh volume
# (no database yet). Existing data is never modified.
if [ ! -f "$DB_FILE" ]; then
  echo "[entrypoint] No database at $DB_FILE - seeding from seed/seed.json"
  node "$EMDASH_CLI" seed --database "$DB_FILE" --uploads-dir "$UPLOADS_DIR" \
    || echo "[entrypoint] Seed skipped/failed (continuing with empty database)"
else
  echo "[entrypoint] Existing database found at $DB_FILE - skipping seed"
fi

exec node ./dist/server/entry.mjs