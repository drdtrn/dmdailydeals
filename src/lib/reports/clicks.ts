import type { Payload } from 'payload'

import { sql } from '@payloadcms/db-postgres/drizzle'

/**
 * Outbound click report (the evidence for affiliate applications), aggregated in SQL.
 *
 * Ranges are rolling windows of N x 24 hours ending at `to` (the moment the report is run), in UTC:
 * `from <= at <= to`. Bots (`is_bot = true`) are never counted in the totals, stores, deals or
 * pages; they are reported separately as `bots`. A NULL `is_bot` counts as a person.
 */
export type StoreRow = { storeId: number | null; name: string; clicks: number }
export type DealRow = {
  dealId: number | null
  title: string
  storeName: string
  clicks: number
}
export type PathRow = { path: string; clicks: number }
export type ClickWindow = {
  days: number
  /** ISO 8601, UTC. */
  from: string
  to: string
  /** Clicks by people (bots excluded). */
  total: number
  /** Clicks classified as bots, for reference. Not included in `total`. */
  bots: number
  perStore: StoreRow[]
  perDeal: DealRow[]
  topPaths: PathRow[]
}
export type ClickReport = { generatedAt: string; windows: ClickWindow[] }

type Db = { drizzle: { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> } }

const NO_PATH = '(direct or unknown)'

export const DEFAULT_WINDOWS_DAYS = [7, 30]

export async function getClickReport(
  payload: Payload,
  {
    now = new Date(),
    windowsDays = DEFAULT_WINDOWS_DAYS,
    limit = 25,
  }: { now?: Date; windowsDays?: number[]; limit?: number } = {},
): Promise<ClickReport> {
  const db = payload.db as unknown as Db
  const run = async <T>(query: ReturnType<typeof sql>) =>
    (await db.drizzle.execute(query)).rows as T[]

  const windows = await Promise.all(
    windowsDays.map(async (days): Promise<ClickWindow> => {
      const to = now
      const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      const range = sql`c.at >= ${from.toISOString()}::timestamptz AND c.at <= ${to.toISOString()}::timestamptz`

      const [totals, perStore, perDeal, topPaths] = await Promise.all([
        run<{ total: string; bots: string }>(sql`
          SELECT count(*) FILTER (WHERE NOT coalesce(c.is_bot, false)) AS total,
                 count(*) FILTER (WHERE coalesce(c.is_bot, false)) AS bots
          FROM clicks c WHERE ${range}`),
        run<{ store_id: number | null; name: string | null; clicks: string }>(sql`
          SELECT c.store_id, s.name, count(*) AS clicks
          FROM clicks c LEFT JOIN stores s ON s.id = c.store_id
          WHERE ${range} AND NOT coalesce(c.is_bot, false)
          GROUP BY c.store_id, s.name
          ORDER BY count(*) DESC, s.name ASC
          LIMIT ${limit}`),
        run<{
          deal_id: number | null
          title: string | null
          store_name: string | null
          clicks: string
        }>(sql`
          SELECT c.deal_id, d.title, s.name AS store_name, count(*) AS clicks
          FROM clicks c
            LEFT JOIN deals d ON d.id = c.deal_id
            LEFT JOIN stores s ON s.id = c.store_id
          WHERE ${range} AND NOT coalesce(c.is_bot, false)
          GROUP BY c.deal_id, d.title, s.name
          ORDER BY count(*) DESC, d.title ASC
          LIMIT ${limit}`),
        run<{ path: string | null; clicks: string }>(sql`
          SELECT c.from_path AS path, count(*) AS clicks
          FROM clicks c
          WHERE ${range} AND NOT coalesce(c.is_bot, false)
          GROUP BY c.from_path
          ORDER BY count(*) DESC, c.from_path ASC
          LIMIT ${limit}`),
      ])

      return {
        days,
        from: from.toISOString(),
        to: to.toISOString(),
        total: Number(totals[0]?.total ?? 0),
        bots: Number(totals[0]?.bots ?? 0),
        perStore: perStore.map((r) => ({
          storeId: r.store_id,
          name: r.name ?? '(deleted store)',
          clicks: Number(r.clicks),
        })),
        perDeal: perDeal.map((r) => ({
          dealId: r.deal_id,
          title: r.title ?? '(deleted deal)',
          storeName: r.store_name ?? '(deleted store)',
          clicks: Number(r.clicks),
        })),
        topPaths: topPaths.map((r) => ({ path: r.path || NO_PATH, clicks: Number(r.clicks) })),
      }
    }),
  )
  return { generatedAt: now.toISOString(), windows }
}

/** "2026-11-21 14:05 UTC" */
export function formatUtc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}
