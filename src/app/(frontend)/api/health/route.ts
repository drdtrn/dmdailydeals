import configPromise from '@payload-config'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { getPayload } from 'payload'

// Liveness plus a database round trip, for the Docker HEALTHCHECK, Caddy and the uptime monitor.
// Per-request, never cached. A static route segment wins over Payload's `/api/[...slug]` catch-all.
export const dynamic = 'force-dynamic'

const HEADERS = { 'Cache-Control': 'no-store' }

/** 200 `{ok:true}` when the app is up and Postgres answers `select 1`; 503 `{ok:false}` otherwise. */
async function check(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    // Race the query against a timeout so a hung database cannot hang the health check.
    await Promise.race([
      payload.db.drizzle.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
    return Response.json({ ok: true }, { headers: HEADERS })
  } catch {
    // No details in the body: the response is public. The cause is in the server log.
    console.error('health: check failed')
    return Response.json({ ok: false }, { status: 503, headers: HEADERS })
  }
}

export const GET = check
export const HEAD = check
