import type { Payload, TaskConfig } from 'payload'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import type { Deal, Media } from '../payload-types'

import { isLocalHost } from '../lib/seo/indexnow'
import { siteOrigin } from '../lib/seo/site'
import type { TelegramDeal } from '../lib/telegram/format'
import { type Photo, postDropToTelegram as postDrop } from '../lib/telegram/post'

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
/** sendPhoto accepts up to 10 MB. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024

function toTelegramDeal(deal: Deal): TelegramDeal {
  return {
    title: deal.title,
    slug: deal.slug ?? String(deal.id),
    price: deal.price,
    wasPrice: deal.wasPrice,
    currency: deal.currency,
  }
}

/** Reads the hero image (the 1600 px `hero` size when there is one) from the media folder. */
async function loadHeroPhoto(payload: Payload, image: Media | number | null | undefined) {
  if (!image || typeof image !== 'object') return null
  const dir = payload.collections.media.config.upload?.staticDir
  if (!dir) return null
  const variant = image.sizes?.hero
  const candidates = [
    variant?.filename && variant.mimeType
      ? { filename: variant.filename, mimeType: variant.mimeType }
      : null,
    image.filename && image.mimeType
      ? { filename: image.filename, mimeType: image.mimeType }
      : null,
  ]
  for (const candidate of candidates) {
    if (!candidate || !PHOTO_TYPES.has(candidate.mimeType)) continue
    // The names come from our own database; basename() keeps them inside the media folder anyway.
    const file = path.join(dir, path.basename(candidate.filename))
    try {
      if ((await stat(file)).size > MAX_PHOTO_BYTES) continue
      const photo: Photo = { ...candidate, data: await readFile(file) }
      return photo
    } catch {
      continue
    }
  }
  return null
}

/**
 * Posts the drop that just went live to the Telegram channel (two messages, see lib/telegram/post).
 *
 * A successful no-op unless `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL_ID` are set, the
 * "Post drops to Telegram" site setting is on and the site URL is public (Telegram rejects
 * localhost button URLs). Message ids are stored on the drop, so a retry never re-sends a message.
 */
export const postDropToTelegram: TaskConfig<'postDropToTelegram'> = {
  slug: 'postDropToTelegram',
  label: 'Post drop to Telegram',
  // Exponential backoff matters for 429s with a long retry_after: an immediate retry would fail again.
  retries: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
  inputSchema: [{ name: 'dropId', type: 'number', required: true }],
  outputSchema: [
    { name: 'skipped', type: 'text' },
    { name: 'photoMessageId', type: 'number' },
    { name: 'listMessageId', type: 'number' },
    { name: 'sent', type: 'number' },
  ],
  handler: async ({ input, req }) => {
    const { payload } = req
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const channelId = process.env.TELEGRAM_CHANNEL_ID?.trim()
    const skip = (reason: string) => {
      payload.logger.info(`postDropToTelegram: skipped (${reason})`)
      return { output: { skipped: reason, sent: 0 } }
    }
    if (!token || !channelId) return skip('TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID is not set')

    const settings = await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (!settings.telegramEnabled) return skip('disabled in site settings')

    const origin = siteOrigin()
    try {
      if (isLocalHost(new URL(origin).hostname)) return skip('site URL is local')
    } catch {
      return skip('site URL is invalid')
    }

    const drop = await payload.findByID({
      collection: 'drops',
      id: input.dropId,
      depth: 2,
      overrideAccess: true,
      req,
    })
    const hero = typeof drop.hero === 'object' ? drop.hero : null
    if (!hero) return skip('drop has no hero deal')
    const picks = (drop.picks ?? []).filter((d): d is Deal => typeof d === 'object' && d !== null)

    const { state, sent } = await postDrop({
      token,
      channelId,
      origin,
      drop: {
        slug: drop.slug ?? '',
        dateIso: drop.date,
        hero: toTelegramDeal(hero),
        picks: picks.map(toTelegramDeal),
      },
      state: drop.telegram ?? {},
      loadPhoto: () => loadHeroPhoto(payload, hero.image),
      saveState: async (telegram) => {
        await payload.update({
          collection: 'drops',
          id: drop.id,
          data: { telegram },
          context: { disableRevalidate: true },
          overrideAccess: true,
          req,
        })
      },
    })

    return {
      output: {
        photoMessageId: state.photoMessageId ?? undefined,
        listMessageId: state.listMessageId ?? undefined,
        sent: sent.length,
      },
    }
  },
}
