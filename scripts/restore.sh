#!/bin/sh
# Restore a backup. POSIX sh. Run inside the `backup` compose service (or any postgres:17 shell):
#
#   restore.sh db    <dump-file> <target-db> [--drop]   restore a pg_dump -Fc file into <target-db>
#   restore.sh media <tarball>   [target-dir]            unpack a media tarball (default /mnt/media)
#
# `db` creates <target-db> when missing and REFUSES to touch a database that already has tables
# unless --drop is given (then it drops and recreates it). Restore into a scratch database first
# (the drill in docs/deploy.md), and only restore over the live database with the stack stopped.
# Needs PGHOST PGUSER PGPASSWORD in the environment.
set -eu
usage() { sed -n '2,12p' "$0" >&2; exit 2; }
[ $# -ge 2 ] || usage
mode="$1"; shift

case "$mode" in
  db)
    dump="$1"; target="${2:-}"; drop="${3:-}"
    [ -n "$target" ] && [ -f "$dump" ] || usage
    # Only plain identifiers, since the name goes into SQL.
    case "$target" in *[!a-zA-Z0-9_]*|"") echo "restore: bad database name" >&2; exit 2;; esac
    exists=$(psql -d postgres -Atc "select 1 from pg_database where datname = '$target'")
    if [ "$exists" = "1" ]; then
      tables=$(psql -d "$target" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")
      if [ "$tables" != "0" ] && [ "$drop" != "--drop" ]; then
        echo "restore: $target already has $tables tables; pass --drop to replace it" >&2; exit 1
      fi
      if [ "$drop" = "--drop" ]; then
        psql -d postgres -v ON_ERROR_STOP=1 -c "drop database \"$target\" with (force)"
        exists=""
      fi
    fi
    [ "$exists" = "1" ] || psql -d postgres -v ON_ERROR_STOP=1 -c "create database \"$target\""
    pg_restore --no-owner --no-acl --exit-on-error --dbname="$target" "$dump"
    echo "restore: $dump -> $target done"
    ;;
  media)
    tarball="$1"; dir="${2:-/mnt/media}"
    [ -f "$tarball" ] || usage
    mkdir -p "$dir"
    tar -C "$dir" -xzf "$tarball"
    echo "restore: $tarball -> $dir done (files keep their owner, uid 1001 for the web container)"
    ;;
  *) usage ;;
esac
