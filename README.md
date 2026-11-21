# DMDailyDeals

Daily curated deals for dmdailydeals.com: one hero deal plus a handful of picks across home, tech and travel, refreshed every day at 9:00 AM ET.

The full product and technical plan, including decisions, phases and verification steps, is in [`plans/01-dmdailydeals-rebuild.md`](plans/01-dmdailydeals-rebuild.md).

## Stack

- [Next.js](https://nextjs.org) 16 (App Router) with [Payload CMS](https://payloadcms.com) 3 running inside the same app (admin at `/admin`)
- PostgreSQL 17
- Tailwind CSS 4
- Vitest (integration tests) and Playwright (end-to-end tests)
- Self-hosted with Docker on a VPS (production setup comes in Phase 9)

## Prerequisites

- [mise](https://mise.jdx.dev): installs the pinned Node (24.22.3) and pnpm (11.x) from `mise.toml`
- Docker with Compose

## Local setup

```bash
mise install                 # Node + pnpm versions from mise.toml
cp .env.example .env         # then fill in the secrets (see comments in the file)
docker compose up -d         # Postgres on 127.0.0.1:5433
pnpm install
pnpm dev                     # http://localhost:3000, admin at /admin
```

On first visit to `/admin`, create the first admin user. In development, Payload syncs the database schema automatically (push mode).

To fill the dev database with example content (categories, stores, 20 deals, today's and yesterday's drops, the eSIM offer and legal page stubs):

```bash
pnpm seed                    # safe to re-run; refuses to run with NODE_ENV=production unless --force
```

The seed data is fake (example.com URLs, placeholder images, "REPLACE" copy) and is for development and tests only.

If your shell has a global Node earlier on `PATH` than mise's shims, run `eval "$(mise env -s bash)"` in the repo first.

## Scripts

| Command                             | What it does                                                    |
| ----------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                          | Dev server                                                      |
| `pnpm build` / `pnpm start`         | Production build / server                                       |
| `pnpm lint`                         | ESLint                                                          |
| `pnpm typecheck`                    | TypeScript check                                                |
| `pnpm format` / `pnpm format:check` | Prettier                                                        |
| `pnpm test:int`                     | Unit + integration tests (needs Postgres, uses a test database) |
| `pnpm seed`                         | Example content for dev/test (never for production)             |
| `pnpm cron:dev`                     | Local job runner loop (publishes drops; see below)              |
| `pnpm migrate`                      | Apply migrations (migration-managed databases)                  |
| `pnpm migrate:create <name>`        | Generate a migration after a schema change                      |
| `pnpm migrate:status`               | Show which migrations have run                                  |
| `pnpm test:e2e`                     | End-to-end tests (starts the dev server)                        |
| `pnpm generate:types`               | Regenerate `src/payload-types.ts` after changing collections    |
| `pnpm generate:importmap`           | Regenerate the admin import map after changing admin components |

## Jobs and the daily drop

Scheduled work (publishing the due drop, expiring deals, revalidating pages, pinging IndexNow) runs as Payload jobs. There is no `autoRun` and no `jobs:handle-schedules`: the only runner is the HTTP endpoint `GET /api/payload-jobs/run?queue=<name>`, protected by `Authorization: Bearer $CRON_SECRET`. It also queues the scheduled tasks (`publishDueDrops` every minute, on the `drops` queue). Follow-up tasks go on the `default` queue.

Locally, run the loop next to `pnpm dev`:

```bash
pnpm cron:dev                # every 60 s: ?queue=drops, then ?queue=default
```

`scripts/cron-loop.sh` is plain `sh` + `curl`, so the production `cron` container can run the same file. It reads `CRON_SECRET` from the environment (or from `./.env`) and accepts:

| Variable      | Default                 | Meaning                        |
| ------------- | ----------------------- | ------------------------------ |
| `BASE_URL`    | `http://localhost:3000` | App to call                    |
| `CRON_SECRET` | from `.env`             | Bearer secret (required)       |
| `INTERVAL`    | `60`                    | Seconds between rounds         |
| `QUEUES`      | `drops default`         | Queues to run, in order        |
| `TIMEOUT`     | `55`                    | Per-request timeout in seconds |
| `ONCE`        | unset                   | `1` runs one round and exits   |

A scheduled job is queued with `waitUntil` set to the next minute, so a drop goes live within about two minutes of its `publishAt`. After a drop goes live, `revalidateDrop` invalidates the cache tags (`drop:current`, `drops`, `drop:<date>`, `category:<slug>`, `store:<slug>`, `deal:<id>`, `sitemap`) and warms `/` and `/drops/<date>` through self calls (`INTERNAL_SERVER_URL`, default `http://127.0.0.1:$PORT`).

`/go/<deal id>` is the outbound redirect: it applies the store's link template (only when the store's affiliate status is `active`), answers `302` with `Cache-Control: no-store`, and logs the click (no IP address, no user agent) after the response.

## Database schema workflow

Payload has two ways to change the schema, and they must never be mixed on one database.

| Database                                        | Mode       | How                                                                             |
| ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| Local dev (`dmdailydeals`)                      | push       | Automatic when you run `pnpm dev`. Nothing to do.                               |
| CI, production, any fresh or migration-check db | migrations | `PAYLOAD_DB_PUSH=false`, then `pnpm migrate` (production runs them on startup). |

1. Change a collection or global. `pnpm dev` pushes it to your dev database.
2. When the feature is done, generate a migration against a **migration-managed** database, not the dev one:

   ```bash
   docker exec dmdailydeals-postgres-1 psql -U dmdd -d postgres -c 'CREATE DATABASE dmdailydeals_mig'
   export DATABASE_URL=postgresql://dmdd:dmdd_dev@127.0.0.1:5433/dmdailydeals_mig PAYLOAD_DB_PUSH=false
   pnpm migrate               # bring that database up to date with the committed migrations
   pnpm migrate:create add_something
   pnpm migrate && pnpm migrate:status
   pnpm generate:types
   ```

   Commit the new files in `src/migrations/` (including the updated `index.ts`).

3. CI runs `pnpm payload migrate` on its fresh database with push disabled, then fails if the schema has drifted from the committed migrations.

Notes:

- Never run `pnpm build` or `pnpm start` with `PAYLOAD_DB_PUSH=false` against the push-managed dev database: Payload would ask an interactive "data loss" question. Without the variable, migrations are not run.
- Do not run `pnpm build` against an **empty** migration-managed database: the build's workers would all try to run the migrations at once. Run `pnpm migrate` first.
- If `pnpm dev` stops on a "column created or renamed?" prompt (push mode only), answer it in the terminal, or reset the dev database.
- Integration tests use a separate database (`dmdailydeals_test`, or `TEST_DATABASE_URL`) and refuse to run against anything not ending in `_test` (outside CI). Create it once: `docker exec dmdailydeals-postgres-1 psql -U dmdd -d postgres -c 'CREATE DATABASE dmdailydeals_test'`.
- Uploaded media goes to `PAYLOAD_MEDIA_DIR` (default `./media`, gitignored).

## Branches

- `develop`: the rebuild (this app)
- `legacy-version`: the previous Express/EJS/Vite site, kept frozen for reference
