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

On first visit to `/admin`, create the first admin user. In development, Payload syncs the database schema automatically.

If your shell has a global Node earlier on `PATH` than mise's shims, run `eval "$(mise env -s bash)"` in the repo first.

## Scripts

| Command                             | What it does                                                    |
| ----------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                          | Dev server                                                      |
| `pnpm build` / `pnpm start`         | Production build / server                                       |
| `pnpm lint`                         | ESLint                                                          |
| `pnpm typecheck`                    | TypeScript check                                                |
| `pnpm format` / `pnpm format:check` | Prettier                                                        |
| `pnpm test:int`                     | Integration tests (needs Postgres running)                      |
| `pnpm test:e2e`                     | End-to-end tests (starts the dev server)                        |
| `pnpm generate:types`               | Regenerate `src/payload-types.ts` after changing collections    |
| `pnpm generate:importmap`           | Regenerate the admin import map after changing admin components |

## Branches

- `develop`: the rebuild (this app)
- `legacy-version`: the previous Express/EJS/Vite site, kept frozen for reference
