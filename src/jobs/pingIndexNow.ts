import type { TaskConfig } from 'payload'

import type { Deal } from '../payload-types'

import { buildIndexNowUrls, INDEXNOW_ENDPOINT, resolveIndexNowTarget } from '../lib/seo/indexnow'

/**
 * Tells IndexNow (Bing, Yandex, Seznam, Naver, Yep, ...; not Google) about the pages a drop changed.
 *
 * A successful no-op when `INDEXNOW_KEY` is unset or the site URL is local, so dev and CI never ping.
 * 200 and 202 are OK. Anything else throws so the job is retried (429 and 5xx are transient; a 4xx
 * such as 403 means the key file is not being served yet, see below, and shows up as a failed job).
 *
 * The key file is served at `/indexnow-key.txt` (see `app/indexnow-key.txt/route.ts`) and sent as
 * `keyLocation`; if that route is not reachable on the public host, IndexNow answers 403.
 */
export const pingIndexNow: TaskConfig<'pingIndexNow'> = {
  slug: 'pingIndexNow',
  label: 'Ping IndexNow',
  retries: { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
  inputSchema: [{ name: 'dropId', type: 'number', required: true }],
  outputSchema: [
    { name: 'skipped', type: 'text' },
    { name: 'submitted', type: 'number' },
    { name: 'status', type: 'number' },
  ],
  handler: async ({ input, req }) => {
    const resolved = resolveIndexNowTarget(
      process.env.NEXT_PUBLIC_SERVER_URL,
      process.env.INDEXNOW_KEY,
    )
    if ('skip' in resolved) {
      req.payload.logger.info(`pingIndexNow: skipped (${resolved.skip})`)
      return { output: { skipped: resolved.skip, submitted: 0 } }
    }
    const { target } = resolved

    const drop = await req.payload.findByID({
      collection: 'drops',
      id: input.dropId,
      depth: 1,
      overrideAccess: true,
      req,
    })
    const deals = [drop.hero, ...(drop.picks ?? [])].filter(
      (d): d is Deal => typeof d === 'object' && d !== null,
    )
    const urlList = buildIndexNowUrls(
      target.origin,
      drop.slug ?? '',
      deals.map((d) => d.slug),
    )

    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: target.host,
        key: target.key,
        keyLocation: target.keyLocation,
        urlList,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (res.status !== 200 && res.status !== 202) {
      const detail = (await res.text().catch(() => '')).slice(0, 200)
      throw new Error(`IndexNow responded ${res.status}${detail ? `: ${detail}` : ''}`)
    }
    return { output: { submitted: urlList.length, status: res.status } }
  },
}
