import { TZDate } from '@date-fns/tz'

/**
 * Pure drop-time helpers. No Payload, no Next, no I/O, so they are cheap to unit test.
 * Phase 3's drop engine builds on `getNextDropAt`.
 */

export type DropTimeSettings = {
  /** "HH:mm", 24-hour, in `timezone`. */
  dropTime: string
  /** IANA time zone name, e.g. "America/New_York". */
  timezone: string
  /** Optional one-off override of the next drop instant. */
  nextDropOverride?: Date | string | null
}

export const DEFAULT_DROP_SETTINGS: DropTimeSettings = {
  dropTime: '09:00',
  timezone: 'America/New_York',
  nextDropOverride: null,
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidDropTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value)
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function parseDropTime(value: string): { hours: number; minutes: number } {
  const match = TIME_RE.exec(value)
  if (!match) throw new Error(`Invalid drop time "${value}", expected HH:mm (24-hour)`)
  return { hours: Number(match[1]), minutes: Number(match[2]) }
}

/** Merge partial settings (e.g. a global read that may be empty) over the defaults. */
export function resolveDropSettings(
  partial?: Partial<Record<keyof DropTimeSettings, unknown>> | null,
): DropTimeSettings {
  const dropTime = isValidDropTime(partial?.dropTime)
    ? partial.dropTime
    : DEFAULT_DROP_SETTINGS.dropTime
  const timezone = isValidTimeZone(partial?.timezone)
    ? partial.timezone
    : DEFAULT_DROP_SETTINGS.timezone
  const override = partial?.nextDropOverride
  return {
    dropTime,
    timezone,
    nextDropOverride: typeof override === 'string' || override instanceof Date ? override : null,
  }
}

/**
 * Calendar day ("YYYY-MM-DD") of a stored date value. Drop dates are day-only values, so the
 * UTC date part of the stored instant is the calendar day the editor picked.
 */
export function ymdFromDateValue(value: Date | string): string {
  const iso = value instanceof Date ? value.toISOString() : value
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  if (!match) throw new Error(`Cannot read a calendar date from "${iso}"`)
  return match[1]
}

/**
 * Strictly parse a `YYYY-MM-DD` URL segment. Returns the same string when it is a real calendar date
 * (so "2026-02-30" and "2026-1-5" are rejected), otherwise null.
 */
export function parseDropDate(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const match = YMD_RE.exec(value)
  if (!match) return null
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(y, m - 1, d))
  const valid =
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  return valid ? value : null
}

/** The calendar day `n` days after `ymd` (negative for earlier). */
export function addDaysToYmd(ymd: string, n: number): string {
  const match = YMD_RE.exec(ymd)
  if (!match) throw new Error(`Invalid date "${ymd}", expected YYYY-MM-DD`)
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + n))
  return d.toISOString().slice(0, 10)
}

/** The calendar day it currently is in `timezone`. */
export function todayInTimezone(now: Date, timezone: string): string {
  const z = new TZDate(now.getTime(), timezone)
  const pad = (v: number, len = 2) => String(v).padStart(len, '0')
  return `${pad(z.getFullYear(), 4)}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`
}

/** The instant a drop dated `ymd` goes live: `dropTime` on that day in `timezone`. DST-safe. */
export function computePublishAt(
  ymd: string,
  settings: Pick<DropTimeSettings, 'dropTime' | 'timezone'>,
): Date {
  const match = YMD_RE.exec(ymd)
  if (!match) throw new Error(`Invalid drop date "${ymd}", expected YYYY-MM-DD`)
  const { hours, minutes } = parseDropTime(settings.dropTime)
  const z = new TZDate(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    hours,
    minutes,
    0,
    0,
    settings.timezone,
  )
  return new Date(z.getTime())
}

/**
 * The next drop instant strictly after `now`. A valid future `nextDropOverride` wins.
 */
export function getNextDropAt(now: Date, settings: DropTimeSettings): Date {
  if (settings.nextDropOverride) {
    const override = new Date(settings.nextDropOverride)
    if (!Number.isNaN(override.getTime()) && override.getTime() > now.getTime()) return override
  }
  const today = todayInTimezone(now, settings.timezone)
  const todays = computePublishAt(today, settings)
  if (todays.getTime() > now.getTime()) return todays
  return computePublishAt(addDaysToYmd(today, 1), settings)
}
