#!/usr/bin/env bash
# Usage: DATABASE_URL=… [UPLOAD_DIR=./storage] [KEEP=14] scripts/backup.sh [backup-dir]
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
UPLOAD_DIR="${UPLOAD_DIR:-./storage}"
KEEP="${KEEP:-14}"
DEST="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$DEST"
pg_dump --format=custom --no-owner --no-acl --file "$DEST/db-$STAMP.dump.partial" "$DATABASE_URL"
mv "$DEST/db-$STAMP.dump.partial" "$DEST/db-$STAMP.dump"

if [ -d "$UPLOAD_DIR" ]; then
  tar --exclude=./tmp -czf "$DEST/uploads-$STAMP.tar.gz.partial" -C "$UPLOAD_DIR" .
  mv "$DEST/uploads-$STAMP.tar.gz.partial" "$DEST/uploads-$STAMP.tar.gz"
fi

for pattern in 'db-*.dump' 'uploads-*.tar.gz'; do
  find "$DEST" -maxdepth 1 -name "$pattern" | sort -r | tail -n +"$((KEEP + 1))" | xargs -r rm --
done

echo "Backup written to $DEST (stamp $STAMP, keeping $KEEP)"
