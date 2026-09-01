#!/usr/bin/env bash
# Restore an encrypted ToDoList backup.
#   Usage: restore.sh <dump.sql.gz.gpg> [target_db]
# Restores into the live 'todolist' DB by default — pass a scratch DB name to
# test a backup non-destructively (e.g. restore.sh file.gpg todolist_restore_test).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/backup.env"

FILE="${1:?usage: restore.sh <dump.sql.gz.gpg> [target_db]}"
TARGET="${2:-${POSTGRES_DB:-todolist}}"
POSTGRES_USER="${POSTGRES_USER:-todolist}"

cd "$COMPOSE_DIR"
echo "[restore] decrypting $FILE -> DB '$TARGET' …"
gpg --batch --yes --decrypt --passphrase-file "$GPG_PASSPHRASE_FILE" "$FILE" \
  | gunzip \
  | docker compose exec -T postgres psql -v ON_ERROR_STOP=0 -U "$POSTGRES_USER" -d "$TARGET"
echo "[restore] done."
