#!/bin/sh
# Job runner loop: every INTERVAL seconds, call the Payload jobs endpoint for each queue.
#
#   GET $BASE_URL/api/payload-jobs/run?queue=<name>   (Authorization: Bearer $CRON_SECRET)
#
# That endpoint is the only job runner (no autoRun, no jobs:handle-schedules): it also queues the
# scheduled tasks (publishDueDrops every minute), then runs the queued jobs.
#
# POSIX sh + curl only, so the Phase 9 compose `cron` container can run this same file.
#
# Environment:
#   BASE_URL     default http://localhost:3000
#   CRON_SECRET  required; falls back to the value in ./.env when run from the repo root
#   INTERVAL     seconds between rounds, default 60
#   QUEUES       space-separated queues, run in order, default "drops default"
#   TIMEOUT      per-request timeout in seconds, default 55
#   EXTRA_QUERY  extra query string appended to every request, e.g. "limit=1&disableScheduling=true"
#   ONCE         set to 1 to run a single round and exit (handy for checks)
#
# Run TWO loops (two processes, or the two Phase 9 compose `cron` containers) so a slow AI job can
# never delay a drop:
#   A (drops and follow-ups):  sh scripts/cron-loop.sh
#   B (AI drafts, one at a time, long timeout):
#     QUEUES=ai EXTRA_QUERY='limit=1&disableScheduling=true' TIMEOUT=900 sh scripts/cron-loop.sh
# (`pnpm cron:dev` runs loop A; `pnpm cron:ai` runs loop B.)

BASE_URL="${BASE_URL:-http://localhost:3000}"
INTERVAL="${INTERVAL:-60}"
QUEUES="${QUEUES:-drops default}"
TIMEOUT="${TIMEOUT:-55}"
EXTRA_QUERY="${EXTRA_QUERY:-}"

# Read only CRON_SECRET from .env, without sourcing the file (it holds other secrets).
if [ -z "${CRON_SECRET:-}" ] && [ -f .env ]; then
  CRON_SECRET=$(sed -n 's/^CRON_SECRET=//p' .env | tail -n 1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//")
fi
if [ -z "${CRON_SECRET:-}" ]; then
  echo "cron-loop: CRON_SECRET is not set (and not found in .env)" >&2
  exit 1
fi

OUT=$(mktemp)

run_queue() {
  queue="$1"
  # The header goes through a here-doc config on stdin so the secret never appears in `ps`.
  status=$(curl --silent --show-error --output "$OUT" --write-out '%{http_code}' \
    --max-time "$TIMEOUT" --config - "$BASE_URL/api/payload-jobs/run?queue=$queue${EXTRA_QUERY:+&$EXTRA_QUERY}" <<CONFIG 2>&1
header = "Authorization: Bearer $CRON_SECRET"
CONFIG
  ) || status="curl-failed"
  printf '%s cron-loop: queue=%s status=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$queue" "$status" \
    "$(head -c 300 "$OUT" 2>/dev/null | tr '\n' ' ')"
}

trap 'rm -f "$OUT"; exit 0' INT TERM
trap 'rm -f "$OUT"' EXIT

echo "cron-loop: $BASE_URL queues=[$QUEUES] every ${INTERVAL}s${EXTRA_QUERY:+ extra=[$EXTRA_QUERY]}"
while :; do
  for q in $QUEUES; do run_queue "$q"; done
  [ "${ONCE:-}" = "1" ] && exit 0
  sleep "$INTERVAL" &
  wait $!
done
