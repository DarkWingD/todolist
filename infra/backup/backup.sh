#!/usr/bin/env bash
# Encrypted, off-box ToDoList database backup.
#   pg_dump  ->  gzip  ->  gpg (AES256)  ->  local file  ->  rclone upload
# Config lives in backup.env (same directory). Secrets stay on the host.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/backup.env"

: "${COMPOSE_DIR:?set in backup.env}"
: "${BACKUP_DIR:?set in backup.env}"
: "${RETENTION_DAYS:?set in backup.env}"
: "${GPG_PASSPHRASE_FILE:?set in backup.env}"
POSTGRES_USER="${POSTGRES_USER:-todolist}"
POSTGRES_DB="${POSTGRES_DB:-todolist}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"      # e.g. gdrive:todolist-backups ; empty = local-only
RCLONE_BIN="${RCLONE_BIN:-rclone}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%F-%H%M%S)"
OUT="$BACKUP_DIR/todolist-$TS.sql.gz.gpg"

echo "[backup] dumping database…"
cd "$COMPOSE_DIR"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "$GPG_PASSPHRASE_FILE" -o "$OUT"
echo "[backup] wrote $OUT ($(du -h "$OUT" | cut -f1))"

# ─────────── off-box upload (provider interface) ───────────
# Swap providers by pointing RCLONE_REMOTE at a different rclone remote — the
# rest of this script never changes. To replace rclone entirely, reimplement
# just this function.
upload() {
  local file="$1"
  if [ -z "$RCLONE_REMOTE" ]; then
    echo "[backup] RCLONE_REMOTE unset — keeping local copy only"
    return 0
  fi
  echo "[backup] uploading to $RCLONE_REMOTE …"
  if "$RCLONE_BIN" copy "$file" "$RCLONE_REMOTE"; then
    echo "[backup] uploaded off-box"
  else
    echo "[backup] WARNING: off-box upload failed (local backup still saved)"
  fi
}
upload "$OUT"

# ─────────── retention ───────────
find "$BACKUP_DIR" -name 'todolist-*.sql.gz.gpg' -mtime +"$RETENTION_DAYS" -delete
if [ -n "$RCLONE_REMOTE" ]; then
  "$RCLONE_BIN" delete --min-age "${RETENTION_DAYS}d" "$RCLONE_REMOTE" 2>/dev/null || true
fi

echo "[backup] done."
