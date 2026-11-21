# Deploying DMDailyDeals to the VPS

Follow this top to bottom the first time. The stack is one Docker Compose project (`compose.prod.yml`)
behind Cloudflare:

```
Cloudflare (proxied DNS, TLS, static cache, AI crawler settings)
   |  HTTPS, only Cloudflare IPs are accepted
Caddy (:80/:443, Origin Certificate)
   |-- dmdailydeals.com        -> web:3000   (Next.js + Payload, ONE replica)
   |-- www.dmdailydeals.com    -> 301 to the apex
   '-- stats.dmdailydeals.com  -> umami:3000
web <-> postgres (app DB)      umami <-> postgres (own `umami` DB and role)
cron    (loop A) -> web:3000/api/payload-jobs/run  queues: drops, default  every 60 s
cron-ai (loop B) -> web:3000/api/payload-jobs/run  queue: ai, limit=1, 15 min timeout
backup  nightly 03:00 UTC: pg_dump of both databases + media tarball (+ optional rclone upload)
```

Files: `Dockerfile`, `compose.prod.yml`, `caddy/`, `postgres/initdb/`, `scripts/`, `.env.production.example`,
`.github/workflows/deploy.yml`. `compose.local.yml` is for the local rehearsal only (last section).

## 0. Rules this stack relies on

- **One `web` replica.** The ISR/tag cache and the signup rate limiter are in memory. Never scale it.
- **The origin only talks to Cloudflare.** The app trusts `CF-Connecting-IP` for rate limiting, so the
  header must not be forgeable. Caddy drops every connection that does not come from a Cloudflare range
  (step 3), and the host firewall should do the same (step 1).
- **Never send `Referrer-Policy: no-referrer`** (Amazon anti-cloaking rule). Neither Caddy nor the app does.
- **Never run the seed in production.** It is development fixture data (fake stores, example.com URLs).
  Real deals are entered in the admin.
- No secret is in the image. Secrets live in `.env.production` on the VPS (mode 600, never committed).

## 1. VPS prerequisites

1. A Linux VPS with a public IP, a non-root sudo user and an SSH key.
2. Install Docker Engine and the Compose plugin (<https://docs.docker.com/engine/install/>), then
   `sudo usermod -aG docker $USER` and log in again. Check: `docker compose version`.
3. Firewall: SSH from anywhere (or your IP), **80 and 443 only from Cloudflare**. Docker publishes ports
   around ufw's rules, so use the `DOCKER-USER` chain (it survives restarts when saved). Option A, on top
   of Caddy's own allowlist (which already protects you), with ipset and iptables:

   ```bash
   sudo apt-get install -y ipset iptables-persistent
   sudo ipset create cloudflare4 hash:net -exist
   sudo ipset create cloudflare6 hash:net family inet6 -exist
   for ip in $(curl -fsS https://www.cloudflare.com/ips-v4); do sudo ipset add cloudflare4 $ip -exist; done
   for ip in $(curl -fsS https://www.cloudflare.com/ips-v6); do sudo ipset add cloudflare6 $ip -exist; done
   # Docker has already DNATed the packet, so match the original destination port with conntrack.
   sudo iptables  -I DOCKER-USER -p tcp -m conntrack --ctorigdstport 80  -m set ! --match-set cloudflare4 src -j DROP
   sudo iptables  -I DOCKER-USER -p tcp -m conntrack --ctorigdstport 443 -m set ! --match-set cloudflare4 src -j DROP
   sudo ip6tables -I DOCKER-USER -p tcp -m conntrack --ctorigdstport 80  -m set ! --match-set cloudflare6 src -j DROP
   sudo ip6tables -I DOCKER-USER -p tcp -m conntrack --ctorigdstport 443 -m set ! --match-set cloudflare6 src -j DROP
   sudo netfilter-persistent save   # ipsets: also save them, e.g. `ipset save > /etc/iptables/ipsets`
   ```

   Option B, ufw (only if Docker is configured not to bypass ufw, e.g. with `ufw-docker`): `ufw allow ssh`,
   then for each range `ufw allow from <range> to any port 80,443 proto tcp`. Option C: the provider's
   cloud firewall with the same ranges, which is the least fiddly. Whichever you use, re-check the lists
   a few times a year (<https://www.cloudflare.com/ips/>).
4. Create the deploy directory and give your user ownership:
   `sudo mkdir -p /opt/dmdailydeals && sudo chown $USER /opt/dmdailydeals`.

## 2. Cloudflare

DNS (zone `dmdailydeals.com`), all **Proxied** (orange cloud), pointing at the VPS IP:

| Type | Name    | Content         |
| ---- | ------- | --------------- |
| A    | `@`     | VPS IPv4        |
| A    | `www`   | VPS IPv4        |
| A    | `stats` | VPS IPv4        |
| AAAA | same    | VPS IPv6, if any |

Then, in the dashboard:

1. **SSL/TLS > Overview**: encryption mode **Full (strict)**.
2. **SSL/TLS > Origin Server > Create Certificate**: RSA or ECC, hostnames `dmdailydeals.com` and
   `*.dmdailydeals.com`, 15 years. Save the two blocks on the VPS as
   `/opt/dmdailydeals/caddy/certs/origin.pem` (certificate) and `origin.key` (private key); `chmod 600
   origin.key`. Keep the key out of git (`caddy/certs/` is gitignored).
3. **SSL/TLS > Edge Certificates**: Always Use HTTPS **on**, Minimum TLS 1.2.
4. **Caching**: cache **static assets only**. Leave Cloudflare's defaults (it caches by file extension and
   respects `Cache-Control`; `/_next/static/*` is immutable). Do **not** add "Cache Everything" and do not
   cache HTML, `/admin`, `/api/*` or `/go/*`: `revalidateTag` cannot purge a CDN.
5. **Network > IP Geolocation: On**, so every request carries `CF-IPCountry` (used by the click log).
6. **Security > Settings > AI Crawler and Agent access policies** (shown as AI Crawl Control; the labels
   were renamed in November 2026, so look for the three categories):
   - **Search: Allow**
   - **Agent: Allow**
   - **Training: Allow** (decision D7)

   **Never set any of them to "Block".** Blocking also blocks Googlebot, Applebot and Bingbot. Also leave
   "Block AI bots", "AI Labyrinth" and "Manage your robots.txt" **off**: the app serves its own robots.txt.
7. Optional: a Cloudflare "Always Online" and bot-fight settings are fine, but check Search Console's live
   URL test after any security change (a challenge page for Googlebot hurts indexing).

**Alternative TLS (ACME DNS challenge).** If you prefer Let's Encrypt over an Origin Certificate, build a
Caddy with the Cloudflare DNS plugin (`xcaddy build --with github.com/caddy-dns/cloudflare`, or a small
Dockerfile `FROM caddy:2.11.9-builder`), replace the `tls /certs/origin.pem /certs/origin.key` line in
`caddy/Caddyfile` with `tls { dns cloudflare {env.CF_API_TOKEN} }`, give the container a Cloudflare API token
(Zone.DNS edit) and drop the `caddy/certs` mount. The Origin Certificate needs no plugin and no token, which
is why it is the default.

## 3. How the Cloudflare lock works (and what to check)

`caddy/cloudflare-ips.caddy` holds Cloudflare's current ranges. `caddy/Caddyfile` uses them twice:
`trusted_proxies` (so `{client_ip}` and forwarded headers come from `CF-Connecting-IP`) and a matcher in every
site that **aborts** the connection when the peer is not a Cloudflare address. Refresh the file with:

```bash
sh scripts/update-cloudflare-ips.sh
docker compose --env-file .env.production -f compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

(commit the changed file; the deploy workflow ships it). Verify from your laptop that the origin refuses you:
`curl -vk --resolve dmdailydeals.com:443:<VPS IP> https://dmdailydeals.com/` must end in a reset or empty
reply, while `https://dmdailydeals.com/` through Cloudflare works. `ALLOW_EXTRA_CIDRS` (compose) is empty in
production; only the local rehearsal widens it.

## 4. First deploy

On the VPS, in `/opt/dmdailydeals`:

1. Get the deploy files there. Either run the GitHub workflow once with "Deploy" unticked and copy them, or
   copy straight from your machine:
   `scp -r compose.prod.yml caddy postgres scripts user@vps:/opt/dmdailydeals/`
   (you need `compose.prod.yml`, `caddy/`, `postgres/initdb/` and `scripts/`; no source code).
2. Create the env file and fill every value (generation commands are in the comments):

   ```bash
   cp .env.production.example .env.production && chmod 600 .env.production
   $EDITOR .env.production
   ```

   Required: `POSTGRES_PASSWORD`, `UMAMI_DB_PASSWORD`, `PAYLOAD_SECRET`, `CRON_SECRET`, `PREVIEW_SECRET`,
   `UMAMI_APP_SECRET`, `NEXT_PUBLIC_SERVER_URL=https://dmdailydeals.com`. Optional groups: `INDEXNOW_KEY`,
   `TELEGRAM_*`, `AI_*`/`DEEPSEEK_API_KEY`/`OPENAI_API_KEY`/`TAVILY_API_KEY`, `RCLONE_*`. Use hex values
   (`openssl rand -hex 32`) so nothing needs URL escaping.
3. Make the image available (see "GitHub" below). The image tag is `WEB_IMAGE_TAG` in `.env.production`.
   If the GHCR package is private, log in once on the VPS: `docker login ghcr.io -u <user>` with a token
   that has `read:packages`. The image holds no secrets, so making the package public is also fine.
4. Put the Origin Certificate in `caddy/certs/` (step 2.2), then:

   ```bash
   alias dc='docker compose --env-file .env.production -f compose.prod.yml'
   dc pull web
   dc up -d
   dc ps            # web becomes "healthy" after the migrations ran
   dc logs -f web   # "Migrated: 2026..._initial" then "instrumentation: Payload initialised"
   ```

   The first boot applies the committed migrations (`PAYLOAD_DB_PUSH=false`, `NODE_ENV=production`):
   `src/instrumentation.ts` initialises Payload at server start, so it happens at boot and not on the first
   visitor's request. `web` is only "healthy" once `/api/health` can query Postgres, and cron and caddy wait
   for that.
5. Check: `curl -s https://dmdailydeals.com/api/health` gives `{"ok":true}`; `/`, `/sitemap.xml`,
   `/robots.txt` return 200 (the home page is empty until a drop exists).

**Umami is open with the default login (admin / umami) from the moment it starts.** Do step 6 right away.

## 5. Create the first admin user

Open `https://dmdailydeals.com/admin`. With an empty database Payload shows "Create first user": enter your
email and a strong password. Do this immediately after the first deploy (nobody else should get there first).
Create editors later under Users. Then create content in this order: Site settings (drop time, timezone),
Categories, Stores, Deals, then a Drop (the cron loop publishes it at the drop time). Real deals only; do
not run `pnpm seed` against production.

## 6. Umami (analytics)

1. Open `https://stats.dmdailydeals.com`, log in as `admin` / `umami`, and **change the password
   immediately** (profile menu > Settings > Profile > Password).
2. Settings > Websites > Add website: name `DMDailyDeals`, domain `dmdailydeals.com`. Copy its **Website ID**.
3. In GitHub, set the repository variables `NEXT_PUBLIC_UMAMI_SRC=https://stats.dmdailydeals.com/script.js`,
   `NEXT_PUBLIC_UMAMI_WEBSITE_ID=<id>` and optionally `NEXT_PUBLIC_UMAMI_DOMAINS=dmdailydeals.com,www.dmdailydeals.com`,
   then run the Deploy workflow again. These are build-time values: a rebuilt image is required.
4. Verify in Umami's realtime view that a page view shows up, and that a click on a deal shows a `deal-cta` event.

## 7. Telegram, AI and IndexNow

- **Telegram**: create a bot with @BotFather, add it as an administrator of your channel, put
  `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL_ID` (`@name` or `-100...`) in `.env.production`, then turn on
  "Post drops to Telegram" in Site settings. Apply with `dc up -d web` (recreates the container with the new env).
- **AI blog drafts**: choose `AI_PROVIDER` and set the matching key (`DEEPSEEK_API_KEY` or `OPENAI_API_KEY`)
  plus `TAVILY_API_KEY`. **Set a monthly spend limit in each provider's console first** (decision D9). Drafting is
  also switched on in Site settings > AI blog drafts, where the monthly cap lives. Drafts are never published
  without human review (D8). Outbound HTTPS to `api.deepseek.com`, `api.openai.com`, `api.tavily.com` is open
  from `web` (the `egress` network).
- **IndexNow**: `INDEXNOW_KEY` (`openssl rand -hex 16`). The app serves it at `/indexnow-key.txt`. After
  setting it, `curl https://dmdailydeals.com/indexnow-key.txt` must print the key.

## 8. Search Console, Bing and uptime

1. Google Search Console: add the property `dmdailydeals.com` (Domain property, DNS TXT record in Cloudflare
   is easiest), submit `https://dmdailydeals.com/sitemap.xml`, and run URL Inspection > Test live URL on `/`.
2. Bing Webmaster Tools: import from Search Console or verify with a DNS TXT/CNAME, and submit the same sitemap.
3. Uptime monitor (UptimeRobot, Better Stack, ...): HTTPS checks on `https://dmdailydeals.com/` (expect 200,
   keyword optional) and `https://dmdailydeals.com/api/health` (expect 200; it is 503 when the database does not
   answer). Check every 1 to 5 minutes and alert by email.

## 9. Backups and the restore drill

The `backup` service runs `scripts/backup-loop.sh`: every day at `BACKUP_AT` (UTC, default 03:00) it writes
`app-<UTC timestamp>.dump`, `umami-<timestamp>.dump` (`pg_dump -Fc`) and `media-<timestamp>.tar.gz` into the
`backups` volume (mode 600) and deletes local files older than `RETENTION_DAYS` (14). I chose a loop inside the
stack over a host crontab because it deploys with the stack and needs nothing configured on the host.
**A backup that stays on the VPS dies with the VPS**: set `RCLONE_REMOTE` (and the `RCLONE_CONFIG_*` variables
in `.env.production.example`) for an off-VPS copy, kept for `RCLONE_RETENTION_DAYS` (30).

Take one by hand and list them:

```bash
dc exec backup sh /scripts/backup.sh
dc exec backup ls -lh /backups
```

**Restore drill (do it once after the first deploy, and every few months).** It restores into a scratch
database, so the live site is untouched:

```bash
F=$(dc exec -T backup sh -c 'ls /backups/app-*.dump | tail -1' | tr -d '\r')
dc exec backup sh /scripts/restore.sh db "$F" restore_drill
for t in deals drops subscribers; do
  echo "$t live=$(dc exec -T -e PGPASSWORD="$(sed -n 's/^POSTGRES_PASSWORD=//p' .env.production)" postgres psql -U dmdd -d dmdailydeals -Atc "select count(*) from $t") restored=$(dc exec -T -e PGPASSWORD="$(sed -n 's/^POSTGRES_PASSWORD=//p' .env.production)" postgres psql -U dmdd -d restore_drill -Atc "select count(*) from $t")"
done
dc exec backup psql -d postgres -c 'drop database restore_drill'
```

The live and restored counts must match (apart from rows created since the backup). `restore.sh db` refuses a
database that already has tables unless you pass `--drop`.

**Real disaster restore** (new VPS or lost data): bring the stack up as in step 4, then stop the app and restore
into the live names: `dc stop web cron cron-ai`, `dc exec backup sh /scripts/restore.sh db /backups/app-<ts>.dump dmdailydeals --drop`,
same for `umami` (`dc stop umami` first), then restore media into the volume (the backup service mounts it
read-only, so use a one-off):
`dc run --rm --no-deps -v dmdailydeals_media:/mnt/media-rw backup sh /scripts/restore.sh media /backups/media-<ts>.tar.gz /mnt/media-rw`,
and finally `dc up -d` (the `media-init` service re-applies uid 1001). On a brand-new VPS, copy the files down from
the rclone remote into the `backups` volume first (`rclone copy offsite:dmdailydeals-backups /tmp/b`, then
`docker cp`). The migrations are idempotent: Payload only runs the ones missing from the restored database.

## 10. GitHub: building and deploying

`.github/workflows/deploy.yml` is **manual** (`workflow_dispatch`): there is no `main` branch yet, so it does not
run on pushes. Setup, once:

1. Repository **variables** (Settings > Secrets and variables > Actions > Variables):
   `NEXT_PUBLIC_SERVER_URL=https://dmdailydeals.com` and, after step 6, the three `NEXT_PUBLIC_UMAMI_*`.
2. Repository **secrets**: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (a private key whose public half is in the
   deploy user's `authorized_keys`; use a dedicated key), optional `VPS_PATH` (default `/opt/dmdailydeals`) and
   `VPS_KNOWN_HOSTS` (output of `ssh-keyscan -t ed25519 <host>` from a trusted machine; without it the host key
   is trusted on first sight during each run).
3. Run it: Actions > Deploy > Run workflow, `ref` = `develop` (default). It builds the image with the build args,
   pushes `ghcr.io/drdtrn/dmdailydeals:sha-<short>` and `:latest`, copies the compose/Caddy/script files to the
   VPS, writes the new tag into `WEB_IMAGE_TAG` in `.env.production`, runs
   `docker compose pull web && docker compose up -d`, and waits for `/api/health`. Migrations run on boot.
   Untick "Deploy" to only build and push.
4. First push of the package: GHCR creates it private. Either make it public (the image has no secrets) under
   the package settings, or `docker login ghcr.io` on the VPS with a `read:packages` token.

## 11. Updating and rolling back

- Update: run the workflow, or by hand `dc pull web && dc up -d`.
- Roll back: set `WEB_IMAGE_TAG=sha-<older>` in `.env.production`, then `dc pull web && dc up -d web`
  (the tags are in the Actions run summaries and in the GHCR package list). Migrations are **forward only**:
  rolling back past a migration needs a database restore (step 9) or a new corrective migration.
- Logs: `dc logs -f web cron cron-ai`. Status: `dc ps`. Restart one service: `dc restart web`.
- Pinned third-party images (`postgres:17-alpine`, `caddy:2.11.9-alpine`, `umami:postgresql-3.0.0`,
  `curlimages/curl:8.14.1`): bump deliberately and read the release notes. Postgres 17 to 18 needs a dump and restore.

## 12. Troubleshooting

| Symptom | Check |
| --- | --- |
| `web` stays `starting` or unhealthy | `dc logs web`: wrong `POSTGRES_PASSWORD` (changing it after the first start does not change the database role; reset it with `ALTER ROLE` or recreate the volume), or a failing migration |
| Caddy returns nothing / connection reset | Expected for non-Cloudflare clients. From Cloudflare: check SSL mode is Full (strict) and `caddy/certs/origin.pem`/`origin.key` exist (`dc logs caddy`) |
| Cloudflare 521 | `dc ps`: is `caddy` up and `web` healthy? Firewall allowing Cloudflare on 443? |
| Cloudflare 526 | The Origin Certificate does not cover the host name or is not mounted |
| Umami restarts in a loop | It must reach `binaries.prisma.sh` (the `egress` network); `dc logs umami` |
| Umami says the database does not exist (volume predates `postgres/initdb`) | The init script only runs on an empty data volume. Create it by hand: `dc exec postgres psql -U dmdd -d postgres -c "CREATE ROLE umami LOGIN PASSWORD '<UMAMI_DB_PASSWORD>'" -c "CREATE DATABASE umami OWNER umami"` |
| The drop did not go live | `dc logs cron`: a `status=200` line every minute? `401` means `CRON_SECRET` differs between `cron` and `web`; recreate both: `dc up -d --force-recreate cron cron-ai web` |
| New drop is live but `/` shows the old one | `dc logs web \| grep revalidateDrop`: it should log `warmed / -> 200` |
| Uploads fail ("problem while uploading") | `dc exec web ls -ld /app/media` must be owned by `nextjs`; `dc up -d media-init` fixes it |
| AI drafts never start | Site settings toggle, key and `TAVILY_API_KEY` set? `dc logs cron-ai` shows a line per minute; a long job holds the connection up to 15 minutes by design |
| Everyone is logged out after a deploy | `PAYLOAD_SECRET` changed |
| Wrong visitor country or rate limiting by the proxy's IP | The request did not come through Cloudflare, or IP Geolocation is off |

## 13. Local rehearsal (what was verified, and how to repeat it)

The whole production stack runs locally next to your dev containers, under the project name
`dmdailydeals-prodtest`, on non-privileged ports (web `127.0.0.1:3100`, Caddy `8080/8443`, Postgres `5434`).

```bash
# image with the local URL baked in (nothing secret)
docker build -t ghcr.io/drdtrn/dmdailydeals:rehearsal --build-arg NEXT_PUBLIC_SERVER_URL=http://localhost:3100 .
# env file with random secrets, WEB_IMAGE_TAG=rehearsal, NEXT_PUBLIC_SERVER_URL=http://localhost:3100
sed -e 's|^NEXT_PUBLIC_SERVER_URL=.*|NEXT_PUBLIC_SERVER_URL=http://localhost:3100|' -e 's|^WEB_IMAGE_TAG=.*|WEB_IMAGE_TAG=rehearsal|' \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" -e "s|^UMAMI_DB_PASSWORD=.*|UMAMI_DB_PASSWORD=$(openssl rand -hex 24)|" \
  -e "s|^PAYLOAD_SECRET=.*|PAYLOAD_SECRET=$(openssl rand -hex 32)|" -e "s|^CRON_SECRET=.*|CRON_SECRET=$(openssl rand -hex 32)|" \
  -e "s|^PREVIEW_SECRET=.*|PREVIEW_SECRET=$(openssl rand -hex 32)|" -e "s|^UMAMI_APP_SECRET=.*|UMAMI_APP_SECRET=$(openssl rand -hex 32)|" \
  .env.production.example > .env.production
# a throwaway self-signed certificate for Caddy
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=rehearsal -keyout caddy/certs/origin.key -out caddy/certs/origin.pem
RH='docker compose -p dmdailydeals-prodtest --env-file .env.production -f compose.prod.yml -f compose.local.yml'
$RH up -d
# the standalone image has no seed tooling: seed from the host through the temporary Postgres port
SEED_FORCE=1 PAYLOAD_DB_PUSH=false DATABASE_URL=postgresql://dmdd:<POSTGRES_PASSWORD>@127.0.0.1:5434/dmdailydeals pnpm seed
curl -s http://127.0.0.1:3100/api/health
curl -sk --resolve dmdailydeals.com:8443:127.0.0.1 https://dmdailydeals.com:8443/api/health   # via Caddy
$RH down -v && rm .env.production caddy/certs/origin.*     # removes every container and volume of the rehearsal
```

Note that the seed writes its placeholder images into `./media` on the host, not into the stack's media volume.
