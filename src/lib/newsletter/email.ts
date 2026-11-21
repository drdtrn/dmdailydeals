export const MAX_EMAIL_LENGTH = 254
const MAX_LOCAL_LENGTH = 64

/** Trim and lowercase. Does not validate. */
export function normaliseEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

// Deliberately plain: one "@", a dotted domain, no whitespace, no consecutive dots, no leading or
// trailing dot. We are not trying to prove deliverability, only to reject typos and junk.
const EMAIL_RE = /^[^\s@.]+(?:\.[^\s@.]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

/** True for a plausible, already-normalised address. */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > MAX_EMAIL_LENGTH) return false
  const at = email.lastIndexOf('@')
  if (at < 1 || at > MAX_LOCAL_LENGTH) return false
  return EMAIL_RE.test(email)
}
