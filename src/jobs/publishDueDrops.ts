import type { TaskConfig } from 'payload'

import type { Deal } from '../payload-types'

import { planDropTransition } from '../lib/drops/plan'
import { relId } from '../lib/relId'

/** Queue for the follow-up tasks. The cron runner calls `drops`, then `default`, every minute. */
export const FOLLOW_UP_QUEUE = 'default'

/**
 * Publishes the due drop, archives the previous one and expires finished deals.
 *
 * Idempotent: it only touches rows that still match (scheduled drops that are due, live deals that
 * are past `expiresAt`), so a second or concurrent run finds nothing, changes nothing and queues
 * nothing. The follow-ups (`revalidateDrop`, `pingIndexNow`, `postDropToTelegram`) are queued only after something changed.
 *
 * Bulk writes use `disableRevalidate`: revalidation is done once, by `revalidateDrop`.
 */
export const publishDueDrops: TaskConfig<'publishDueDrops'> = {
  slug: 'publishDueDrops',
  label: 'Publish due drops',
  retries: 2,
  schedule: [{ cron: '* * * * *', queue: 'drops' }],
  outputSchema: [
    { name: 'publishedDropId', type: 'number' },
    { name: 'archivedDropIds', type: 'json' },
    { name: 'expiredDealIds', type: 'json' },
    { name: 'queuedFollowUps', type: 'number' },
  ],
  handler: async ({ req }) => {
    const { payload } = req
    const now = new Date()
    const context = { disableRevalidate: true }

    const [dueResult, liveResult] = await Promise.all([
      payload.find({
        collection: 'drops',
        where: {
          and: [{ status: { equals: 'scheduled' } }, { publishAt: { less_than_equal: now } }],
        },
        sort: ['-publishAt', '-date'],
        limit: 100,
        depth: 0,
        pagination: false,
        overrideAccess: true,
        req,
      }),
      payload.find({
        collection: 'drops',
        where: { status: { equals: 'live' } },
        limit: 100,
        depth: 0,
        pagination: false,
        overrideAccess: true,
        req,
      }),
    ])

    const plan = planDropTransition(dueResult.docs, liveResult.docs)

    let published: (typeof dueResult.docs)[number] | null = null
    const archivedDropIds: number[] = []

    if (plan.publish) {
      published = await payload.update({
        collection: 'drops',
        id: plan.publish.id,
        data: { status: 'live' },
        context,
        overrideAccess: true,
        req,
      })
    }
    for (const id of plan.archiveIds) {
      await payload.update({
        collection: 'drops',
        id,
        data: { status: 'archived' },
        context,
        overrideAccess: true,
        req,
      })
      archivedDropIds.push(Number(id))
    }

    // Deals in the drop that just went live stay live even if their expiry is already past.
    const keepLive = published
      ? [relId(published.hero), ...(published.picks ?? []).map(relId)].filter(
          (id): id is number | string => id !== undefined,
        )
      : []

    const expiredDeals: Deal[] = []
    const expiring = await payload.find({
      collection: 'deals',
      where: {
        and: [
          { status: { equals: 'live' } },
          { _status: { equals: 'published' } },
          { expiresAt: { less_than_equal: now } },
          ...(keepLive.length ? [{ id: { not_in: keepLive } }] : []),
        ],
      },
      limit: 1000,
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
    })
    for (const deal of expiring.docs) {
      // Per-document update so a deal that fails validation can't block the others.
      try {
        expiredDeals.push(
          await payload.update({
            collection: 'deals',
            id: deal.id,
            data: { status: 'expired' },
            context,
            overrideAccess: true,
            req,
          }),
        )
      } catch (err) {
        payload.logger.error({ err, msg: `publishDueDrops: could not expire deal ${deal.id}` })
      }
    }

    const expiredDealIds = expiredDeals.map((d) => d.id)
    const changed = Boolean(published) || archivedDropIds.length > 0 || expiredDealIds.length > 0
    let queuedFollowUps = 0

    if (changed) {
      await payload.jobs.queue({
        task: 'revalidateDrop',
        queue: FOLLOW_UP_QUEUE,
        input: { dropId: published ? Number(published.id) : undefined, expiredDealIds },
        req,
      })
      queuedFollowUps++

      if (published) {
        await payload.jobs.queue({
          task: 'pingIndexNow',
          queue: FOLLOW_UP_QUEUE,
          input: { dropId: Number(published.id) },
          req,
        })
        queuedFollowUps++
        // Always queued: the task itself no-ops (successfully) without the env vars or with the
        // site-settings toggle off, so switching it on before the job runs is enough. It stores
        // its message ids on the drop, so a re-queued job never posts twice.
        await payload.jobs.queue({
          task: 'postDropToTelegram',
          queue: FOLLOW_UP_QUEUE,
          input: { dropId: Number(published.id) },
          req,
        })
        queuedFollowUps++
        // Deferred: `sendDropNewsletter` once newsletter delivery is chosen.
      }

      payload.logger.info({
        msg: 'publishDueDrops: changes applied',
        published: published?.slug,
        archivedDropIds,
        expiredDealIds,
      })
    }

    return {
      output: {
        publishedDropId: published ? Number(published.id) : undefined,
        archivedDropIds,
        expiredDealIds,
        queuedFollowUps,
      },
    }
  },
}
