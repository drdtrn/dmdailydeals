#!/bin/sh
# Runs once, when the Postgres data volume is first initialised. Creates the Umami role and database
# with their own password, so a bug or leak in Umami cannot read the app database.
# (To add this to an existing volume, see "Troubleshooting" in docs/deploy.md.)
set -eu
: "${UMAMI_DB_PASSWORD:?UMAMI_DB_PASSWORD must be set}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=umami_password="$UMAMI_DB_PASSWORD" <<'SQL'
CREATE ROLE umami LOGIN PASSWORD :'umami_password';
CREATE DATABASE umami OWNER umami;
REVOKE ALL ON DATABASE umami FROM PUBLIC;
SQL
