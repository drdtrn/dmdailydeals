/**
 * Indexing rules for thin hub pages (plan section C, spam policies: no thin hubs). Pure, so the
 * pages, the metadata and the sitemap all apply the same rule.
 */

/** A store hub needs at least this many published deals to be worth indexing. */
export const MIN_INDEXABLE_STORE_DEALS = 3

/** Evergreen copy is at least as long as a deal's editor note. */
export const MIN_EVERGREEN_INTRO_CHARS = 140

/** Event hubs earn their place a few weeks before the event starts. */
export const EVENT_LEAD_DAYS = 21

const DAY_MS = 24 * 60 * 60 * 1000

export function isThinStore(publishedDealCount: number): boolean {
  return publishedDealCount < MIN_INDEXABLE_STORE_DEALS
}

type EventWindow = {
  startsAt?: string | null
  endsAt?: string | null
  intro?: string | null
}

function time(value?: string | null): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** In season: from `EVENT_LEAD_DAYS` before the start until the end of the window. */
export function isEventInSeason(event: EventWindow, now: Date = new Date()): boolean {
  const start = time(event.startsAt)
  const end = time(event.endsAt)
  if (start === null && end === null) return false
  const t = now.getTime()
  if (start !== null && t < start - EVENT_LEAD_DAYS * DAY_MS) return false
  if (end !== null && t > end) return false
  return true
}

export function hasEvergreenIntro(event: Pick<EventWindow, 'intro'>): boolean {
  return (event.intro ?? '').trim().length >= MIN_EVERGREEN_INTRO_CHARS
}

/** An event hub is indexable in season, or all year when it carries evergreen original copy. */
export function isEventIndexable(event: EventWindow, now: Date = new Date()): boolean {
  return isEventInSeason(event, now) || hasEvergreenIntro(event)
}
