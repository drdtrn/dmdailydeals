/**
 * Display formatting for the storefront. Everything here is pure and deterministic (fixed locale,
 * fixed time zone, no reading of the clock), so server-rendered strings are stable and cacheable.
 */

const LOCALE = 'en-US'
export const DISPLAY_TIME_ZONE = 'America/New_York'

/** "$229", "$19.99". Whole amounts drop the cents. */
export function formatPrice(amount: number, currency = 'USD'): string {
  const whole = Number.isInteger(amount)
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount)
}

/** Whole-number percentage off, or null when there is no real discount. */
export function percentOff(price: number, wasPrice?: number | null): number | null {
  if (!wasPrice || wasPrice <= price || price < 0) return null
  const pct = Math.round((1 - price / wasPrice) * 100)
  return pct >= 1 ? pct : null
}

/** "−38%" with a real minus sign, as in the design. */
export function formatPercentOff(pct: number): string {
  return `−${pct}%`
}

function shortZone(date: Date, timeZone: string): string {
  const name =
    new Intl.DateTimeFormat(LOCALE, { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? ''
  // EST and EDT both read "ET" on the site, whatever the season.
  return timeZone === DISPLAY_TIME_ZONE ? 'ET' : name
}

/** "9:00 AM ET" */
export function formatDropTime(iso: string, timeZone = DISPLAY_TIME_ZONE): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const time = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
  return `${time} ${shortZone(date, timeZone)}`
}

/** "Sat, Nov 21, 9:14 AM ET" (absolute, so a cached page never says "2 hours ago" for days). */
export function formatDateTimeET(iso: string, timeZone = DISPLAY_TIME_ZONE): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    month: 'short',
    day: 'numeric',
  }).format(date)
  return `${day}, ${formatDropTime(iso, timeZone)}`
}

/** "Saturday, November 21" */
export function formatLongDate(iso: string, timeZone = DISPLAY_TIME_ZONE): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/** "Sat, Nov 21" */
export function formatShortDate(iso: string, timeZone = DISPLAY_TIME_ZONE): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/** "Sat, Nov 22, 9:00 AM ET" */
export function formatDropAt(iso: string, timeZone = DISPLAY_TIME_ZONE): string {
  const day = formatShortDate(iso, timeZone)
  const time = formatDropTime(iso, timeZone)
  return day && time ? `${day}, ${time}` : ''
}
