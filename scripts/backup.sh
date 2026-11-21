#!/bin/sh
# One backup run: pg_dump -Fc of the app and Umami databases plus a media tarball, dated filenames,
# retention, and an optional rclone upload. POSIX sh. Runs inside the `backup` compose service
# (postgres:17-alpine), or by hand:
#   docker compose --env-file .env.production -f compose.prod.yml exec backup sh /scripts/backup.sh
#
# Environment (the backup service sets these):
#   PGHOST PGUSER PGPASSWORD   Postgres connection (a role that can dump both databases)
#   APP_DB                     app database, default dmdailydeals
#   UMAMI_DB                   Umami database, default umami; set to "" to skip
#   BACKUP_DIR                 default /backups
#   MEDIA_DIR                  default /mnt/media; set to "" to skip the media tarball
#   RETENTION_DAYS             keep local backups this many days, default 14
#   RCLONE_REMOTE              e.g. "offsite:dmdailydeals-backups"; unset = no upload
#   RCLONE_RETENTION_DAYS      keep remote backups this many days, default 30
set -eu
umask 077 # backups hold personal data (subscriber emails): owner only

APP_DB="${APP_DB:-dmdailydeals}"
UMAMI_DB="${UMAMI_DB-umami}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
MEDIA_DIR="${MEDIA_DIR-/mnt/media}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
RCLONE_RETENTION_DAYS="${RCLONE_RETENTION_DAYS:-30}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

mkdir -p "$BACKUP_DIR"
log() { printf '%s backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Write to a .partial name and rename on success, so a failed run never leaves a file that looks valid.
dump_db() {
  db="$1"; name="$2"; file="$BACKUP_DIR/$name-$STAMP.dump"
  pg_dump --format=custom --no-owner --dbname="$db" --file="$file.partial"
  mv "$file.partial" "$file"
  log "wrote $file ($(du -h "$file" | cut -f1))"
}

dump_db "$APP_DB" app
[ -n "$UMAMI_DB" ] && dump_db "$UMAMI_DB" umami

if [ -n "$MEDIA_DIR" ] && [ -d "$MEDIA_DIR" ]; then
  file="$BACKUP_DIR/media-$STAMP.tar.gz"
  tar -C "$MEDIA_DIR" -czf "$file.partial" .
  mv "$file.partial" "$file"
  log "wrote $file ($(du -h "$file" | cut -f1))"
fi

# Local retention.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'app-*' -o -name 'umami-*' -o -name 'media-*' \) \
  -mtime +"$RETENTION_DAYS" -print -delete | sed 's/^/backup: pruned /'

# Optional off-VPS copy. rclone is installed on first use (the service has outbound access).
if [ -n "${RCLONE_REMOTE:-}" ]; then
  command -v rclone >/dev/null 2>&1 || apk add --no-cache rclone >/dev/null
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*-$STAMP.*" --transfers 2
  rclone delete "$RCLONE_REMOTE" --min-age "${RCLONE_RETENTION_DAYS}d" --include '{app,umami,media}-*'
  log "uploaded $STAMP to $RCLONE_REMOTE"
fi
log "done $STAMP"
