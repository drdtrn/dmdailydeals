import type { Payload } from 'payload'

import type { ClickUtm } from './click'

export type ClickRecord = {
  dealId: number | string
  storeId: number | string
  fromPath?: string
  utm: ClickUtm
  country?: string
  isBot: boolean
}

/**
 * Writes one `clicks` row. Never throws: logging must not break (or even be visible to) the
 * redirect. PRIVACY: no IP address and no user agent string is stored, only the derived fields.
 */
export async function logClick(payload: Payload, click: ClickRecord): Promise<void> {
  try {
    await payload.create({
      collection: 'clicks',
      data: {
        deal: Number(click.dealId),
        store: Number(click.storeId),
        at: new Date().toISOString(),
        fromPath: click.fromPath,
        utm: click.utm,
        country: click.country,
        isBot: click.isBot,
      },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  } catch (err) {
    payload.logger.error({ err, msg: 'Could not log click' })
  }
}
