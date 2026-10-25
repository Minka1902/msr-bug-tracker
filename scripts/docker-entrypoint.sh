#!/bin/sh
set -e
if [ "$(id -u)" = 0 ]; then
  mkdir -p "$UPLOAD_DIR"
  chown node:node "$UPLOAD_DIR"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
