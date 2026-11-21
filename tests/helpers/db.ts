import type { Payload } from 'payload'

import config from '@payload-config'
import { getPayload } from 'payload'

export async function getTestPayload(): Promise<Payload> {
  return getPayload({ config: await config })
}

/** Remove everything the content-model tests create. Safe only on the dedicated test database. */
export async function clearContent(payload: Payload): Promise<void> {
  for (const collection of [
    'drops',
    'price-snapshots',
    'clicks',
    'events',
    'deals',
    'stores',
    'categories',
    'subscribers',
  ] as const) {
    await payload.delete({
      collection,
      where: { id: { exists: true } },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  }
}

let counter = 0
export const uniq = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${counter++}`

export const LONG_NOTE =
  'Tested side by side with the usual alternatives: this one keeps the lowest street price we have tracked, ships free in the US, and the discount is real because the same model sat at the higher price for months.'

/**
 * Assert that a Payload operation fails validation with a message matching `pattern`.
 * Payload's top-level ValidationError message only names the invalid field; the human message
 * lives in `data.errors`.
 */
export async function expectInvalid(operation: Promise<unknown>, pattern: RegExp): Promise<void> {
  let error: unknown
  try {
    await operation
  } catch (err) {
    error = err
  }
  if (!error) throw new Error('Expected the operation to be rejected, but it succeeded')
  const e = error as { message?: string; data?: { errors?: { message?: string }[] } }
  const text = [e.message, ...(e.data?.errors ?? []).map((x) => x.message)].join(' | ')
  if (!pattern.test(text)) throw new Error(`Rejected, but not as expected. Got: ${text}`)
}
