#!/bin/sh
# Runs scripts/backup.sh every day at BACKUP_AT (UTC, HH:MM, default 03:00). A failed run is logged
# and retried the next day; the loop itself never exits (the container would restart anyway).
# BACKUP_ON_START=1 also runs one backup immediately (useful right after the first deploy).
set -u
BACKUP_AT="${BACKUP_AT:-03:00}"
h=${BACKUP_AT%%:*}; m=${BACKUP_AT##*:}
target=$(( ${h#0} * 3600 + ${m#0} * 60 ))
[ "${BACKUP_ON_START:-}" = "1" ] && { sh /scripts/backup.sh || echo "backup-loop: backup FAILED" >&2; }
echo "backup-loop: daily at $BACKUP_AT UTC"
while :; do
  now=$(( $(date -u +%s) % 86400 ))
  wait=$(( target - now ))
  [ "$wait" -le 0 ] && wait=$(( wait + 86400 ))
  sleep "$wait"
  sh /scripts/backup.sh || echo "backup-loop: backup FAILED" >&2
  sleep 61 # never run twice in the same minute
done
