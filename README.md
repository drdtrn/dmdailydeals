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

## Audience and analytics

### Newsletter signups

`NewsletterCta` posts to `/api/subscribe` (a route handler; its static path wins over Payload's `/api/[...slug]` catch-all). Subscribers are **stored in our own database only**: no email is sent yet, and the copy says so.

- JSON bodies get `{ ok: true }` or `{ ok: false, error }`. The no-JS form post (form-encoded) gets a `303` back to the referring page with `?subscribed=1#newsletter` (or `error` / `invalid`); the home page reads the flag on the server.
- Bots: a filled honeypot field (`website`) gets a fake success and stores nothing. There is a per-IP limit of 5 attempts per 10 minutes, in memory only. The IP comes from `CF-Connecting-IP`, then `X-Forwarded-For`, and is never stored or logged. With neither header there is no limit (local development).
- A row stores `email` (trimmed, lowercased), `status`, `source`, `consentAt` and `consentText`, the version of the signup wording (`NEWSLETTER_CONSENT_VERSION` in `src/lib/newsletter/copy.ts`; bump it when the wording changes). A duplicate is a no-op that still shows success; an unsubscribed address is re-activated with fresh consent.
- Export: the subscribers list in the admin has an **Export CSV** button (`GET /api/subscribers/export`, logged-in users only).

### Telegram channel

Each drop is posted when it goes live: the hero photo (uploaded from the media folder, so no public URL is needed) with a "See today's drop" button, then a message listing the picks with the disclosure line. Message ids are stored on the drop, so a retried job never posts twice.

1. Create a public channel (e.g. `@dmdailydeals`) in Telegram.
2. Create a bot with [@BotFather](https://t.me/BotFather) and copy its token.
3. Add the bot to the channel as an **administrator** with the "Post messages" right (`can_post_messages`).
4. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL_ID` (`@dmdailydeals`) in the environment (see `.env.example`).
5. In the admin, open **Site settings**: tick **Post drops to Telegram** and set **Telegram channel URL** (`https://t.me/dmdailydeals`) so the signup box links to the channel.

Without both variables, or with the toggle off, or on a localhost site URL, the job succeeds and does nothing. A rate limit (HTTP 429) is waited out when `retry_after` is short and otherwise fails the job so it retries with backoff.

### Umami (analytics)

The script loads only when `NEXT_PUBLIC_UMAMI_SRC` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID` are set, and only counts the production host (`data-domains` defaults to the host of `NEXT_PUBLIC_SERVER_URL`, so dev and preview traffic is ignored). `NEXT_PUBLIC_*` values are baked in at build time. Events: `deal-cta`, `esim-cta` (from `data-umami-event` attributes) and `newsletter-signup`.

### Click report

**Admin > Click report** (`/admin/reports/clicks`) shows outbound clicks per store and per deal, plus the top source pages, for the last 7 and 30 days. Ranges are rolling windows in UTC with the exact start and end printed. Bots are excluded from every figure and counted separately.

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
