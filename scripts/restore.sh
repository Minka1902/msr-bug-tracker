#!/usr/bin/env bash
# Usage: DATABASE_URL=… [UPLOAD_DIR=./storage] scripts/restore.sh <db-*.dump> [uploads-*.tar.gz]
# Replaces every table in the target database. Set FORCE=1 to skip the prompt.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
DUMP="${1:?Pass the db-*.dump file to restore}"
UPLOADS="${2:-}"
UPLOAD_DIR="${UPLOAD_DIR:-./storage}"

if [ "${FORCE:-0}" != 1 ]; then
  read -r -p "This replaces all data in the target database. Type 'restore' to continue: " answer
  [ "$answer" = restore ] || { echo "Aborted"; exit 1; }
fi

pg_restore --clean --if-exists --no-owner --no-acl --single-transaction --dbname "$DATABASE_URL" "$DUMP"

if [ -n "$UPLOADS" ]; then
  mkdir -p "$UPLOAD_DIR"
  tar -xzf "$UPLOADS" -C "$UPLOAD_DIR"
fi

echo "Restore complete"
