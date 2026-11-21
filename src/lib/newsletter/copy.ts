/**
 * The signup wording and its version. Stored with every subscriber as `consentText`, so we can
 * always say which wording a person agreed to.
 *
 * RULE: when you change any of the wording below in a way that changes what a person is told
 * (not typo fixes), bump `NEWSLETTER_CONSENT_VERSION` too.
 */
export const NEWSLETTER_CONSENT_VERSION = '2026-11-21-v1'

export const NEWSLETTER_HEADING = 'Get the drop by email'

export const NEWSLETTER_DESCRIPTION =
  'Daily emails haven’t started yet. Join the list and we’ll email you when daily drops start, at 9:00 AM ET. Unsubscribe anytime.'

export const NEWSLETTER_SUCCESS = 'You are on the list. We will email you when daily drops start.'
export const NEWSLETTER_ERROR = 'We could not add you just now. Please try again later.'
export const NEWSLETTER_INVALID_EMAIL = 'Please enter a valid email address.'

/** Query flag the no-JS form POST redirects back with (`?subscribed=1#newsletter`). */
export const SUBSCRIBED_PARAM = 'subscribed'
export type SubscribedFlag = 'success' | 'error' | 'invalid'
export const SUBSCRIBED_VALUES: Record<SubscribedFlag, string> = {
  success: '1',
  error: 'error',
  invalid: 'invalid',
}

export function parseSubscribedFlag(value: string | string[] | undefined): SubscribedFlag | null {
  const v = Array.isArray(value) ? value[0] : value
  if (v === SUBSCRIBED_VALUES.success) return 'success'
  if (v === SUBSCRIBED_VALUES.error) return 'error'
  if (v === SUBSCRIBED_VALUES.invalid) return 'invalid'
  return null
}
