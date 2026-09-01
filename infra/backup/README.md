# Backups

Encrypted, automated, off-box database backups for ToDoList.

**Pipeline:** `pg_dump` → `gzip` → `gpg` (AES256) → local file → `rclone` upload.

## Files
| File | Purpose |
|---|---|
| `backup.sh` | Dump + encrypt + upload + prune. Reads `backup.env`. |
| `restore.sh` | Decrypt + restore a dump. `restore.sh <file.sql.gz.gpg> [target_db]` |
| `backup.env.example` | Config template → copy to `scripts/backup.env` on the host. |

On the host these live in `~/todolist/scripts/` (copied from here), alongside the
private `backup.env` and `.backup-passphrase` (chmod 600, never committed).

## Schedule
Runs via **cron** (nightly 02:30):
```
30 2 * * * /home/danielwood/todolist/scripts/backup.sh >> ~/todolist/backups/backup.log 2>&1
```
> We use cron rather than a systemd `--user` timer because the long-running user
> manager predates this user joining the `docker` group and can't reach the Docker
> socket; cron re-initializes the full group set per job.

## Off-box provider (the interface)
The `upload()` function in `backup.sh` uses **rclone**, so switching providers is a
one-line change: set `RCLONE_REMOTE` in `backup.env` to a different remote
(`gdrive:…`, `s3:…`, `b2:…`, `sftp:…`) after configuring it with `rclone config`.
Empty `RCLONE_REMOTE` = local backups only.

### Google Drive setup (one-time)
rclone needs an interactive OAuth. On the host:
```
rclone config
#  n) new remote  → name: gdrive  → storage: drive
#  leave client_id/secret blank, scope: 1 (full) or 3 (drive.file)
#  When it asks "Use web browser to authenticate?": say N (headless),
#  then run `rclone authorize "drive"` on a machine WITH a browser and
#  paste the token back.
rclone mkdir gdrive:todolist-backups
```
Then the next nightly run (or `~/todolist/scripts/backup.sh`) uploads automatically.

## Restore
```
# non-destructive test into a scratch DB:
docker compose exec -T postgres psql -U todolist -d postgres -c 'create database restore_test'
~/todolist/scripts/restore.sh ~/todolist/backups/todolist-<ts>.sql.gz.gpg restore_test

# real restore into the live DB:
~/todolist/scripts/restore.sh ~/todolist/backups/todolist-<ts>.sql.gz.gpg
```

## ⚠️ Passphrase safety
`scripts/.backup-passphrase` decrypts every backup. **Store a copy off the box**
(password manager). If Brutus dies and you only have off-box `.gpg` files, you still
need this passphrase to restore.
