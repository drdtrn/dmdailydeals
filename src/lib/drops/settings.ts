import type { PayloadRequest } from 'payload'

import { type DropTimeSettings, resolveDropSettings } from './time'

/**
 * Drop time settings from the `site-settings` global, merged over the defaults.
 * Never throws: if the global can't be read (e.g. empty table), defaults apply.
 */
export async function getDropSettings(
  req: Pick<PayloadRequest, 'payload'> & Partial<Pick<PayloadRequest, 'transactionID'>>,
): Promise<DropTimeSettings> {
  try {
    const settings = await req.payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
      req: req as PayloadRequest,
    })
    return resolveDropSettings(settings)
  } catch {
    return resolveDropSettings(null)
  }
}
