# syntax=docker/dockerfile:1
# Production image: Next.js 16 standalone output + Payload CMS. See docs/deploy.md.
#
# Base image: Alpine (musl). sharp ships prebuilt musl binaries (@img/sharp-linuxmusl-*), pnpm
# installs the matching one, and nothing else here needs glibc, so Alpine keeps the image small.
# Node and pnpm versions match mise.toml (Node 24.22.3, pnpm 11.28.13 via the packageManager field).
#
# Build:
#   docker build -t ghcr.io/drdtrn/dmdailydeals:dev \
#     --build-arg NEXT_PUBLIC_SERVER_URL=https://dmdailydeals.com .
# No database is needed to build, and no secret goes into the image: only the public NEXT_PUBLIC_*
# build args below, which Next inlines into the client bundle anyway.
FROM node:24.22.3-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install with the lockfile only, so this layer is cached until dependencies change ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time values, inlined into the bundle (NEXT_PUBLIC_*) and into robots.txt. Not secret.
ARG NEXT_PUBLIC_SERVER_URL=https://dmdailydeals.com
ARG NEXT_PUBLIC_UMAMI_SRC=
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=
ARG NEXT_PUBLIC_UMAMI_DOMAINS=
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL \
    NEXT_PUBLIC_UMAMI_SRC=$NEXT_PUBLIC_UMAMI_SRC \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID \
    NEXT_PUBLIC_UMAMI_DOMAINS=$NEXT_PUBLIC_UMAMI_DOMAINS \
    NEXT_TELEMETRY_DISABLED=1
# Placeholders so config loading works. The build never connects to the database (set at run time).
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:1/build \
    PAYLOAD_SECRET=build-time-placeholder-not-used-at-runtime

RUN pnpm build

# ---- runner ----
FROM node:24.22.3-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PAYLOAD_DB_PUSH=false \
    PAYLOAD_MEDIA_DIR=/app/media

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public

# .next must be writable (ISR / image cache). /app/media is the uploads volume mount point; a new
# named volume copies this ownership, so uid 1001 can write to it.
RUN mkdir .next media && chown nextjs:nodejs .next media

# The standalone output includes the traced node_modules (sharp, pg, ...) and src/ai/style-guide.md
# (outputFileTracingIncludes).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
VOLUME ["/app/media"]

# 200 only when the app is up AND Postgres answers (see src/app/(frontend)/api/health/route.ts).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
