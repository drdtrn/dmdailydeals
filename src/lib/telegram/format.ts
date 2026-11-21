import { formatFullDate, formatPrice, percentOff } from '../format'

/** Telegram limits, counted in characters. */
export const CAPTION_LIMIT = 1024
export const MESSAGE_LIMIT = 4096

export const DISCLOSURE_LINE =
  'Paid links: we may earn a commission when you buy through links in this post.'

/** Escapes text for `parse_mode: 'HTML'`. Only `<`, `>` and `&` are special; quotes are for attributes. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Cuts to at most `max` characters (by code point, so no split emoji), ending with an ellipsis. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  if (chars.length <= max) return chars.join('')
  return `${chars
    .slice(0, Math.max(0, max - 1))
    .join('')
    .trimEnd()}…`
}

export type TelegramDeal = {
  title: string
  slug: string
  price: number
  wasPrice?: number | null
  currency: string
}

function priceText(deal: TelegramDeal): string {
  const price = formatPrice(deal.price, deal.currency)
  const pct = percentOff(deal.price, deal.wasPrice)
  return pct && deal.wasPrice
    ? `<b>${escapeHtml(price)}</b> (was ${escapeHtml(formatPrice(deal.wasPrice, deal.currency))}, −${pct}%)`
    : `<b>${escapeHtml(price)}</b>`
}

/**
 * Caption for the hero photo: the drop date, the hero title, price and was-price. HTML-escaped and
 * never longer than 1024 characters (the title is shortened first, then the whole thing is
 * checked; the escaped text counts in full, which is stricter than Telegram's own count).
 */
export function buildCaption({
  dropDateIso,
  hero,
}: {
  /** ISO instant on the drop's calendar day. */
  dropDateIso: string
  hero: TelegramDeal
}): string {
  const heading = `<b>Today’s drop</b> · ${escapeHtml(formatFullDate(dropDateIso))}`
  const build = (title: string) => `${heading}\n\n${escapeHtml(title)}\n${priceText(hero)}`
  let max = 300
  let text = build(truncate(hero.title, max))
  while (Array.from(text).length > CAPTION_LIMIT && max > 10) {
    max = Math.floor(max / 1.5)
    text = build(truncate(hero.title, max))
  }
  return text
}

export function dealUrl(origin: string, slug: string): string {
  return `${origin}/deal/${encodeURIComponent(slug)}`
}

/**
 * The picks list: one line per pick (title linked to its /deal page, with its price), then the
 * disclosure line and a link to the disclosure page. Lines are dropped whole from the end if the
 * message would exceed 4096 characters, so a tag or entity is never cut in half.
 */
export function buildPicksMessage({
  picks,
  origin,
}: {
  picks: TelegramDeal[]
  origin: string
}): string {
  const header = '<b>More picks in today’s drop</b>'
  const footer = `${escapeHtml(DISCLOSURE_LINE)} <a href="${escapeHtml(`${origin}/disclosure`)}">Affiliate disclosure</a>`
  const lines = picks.map((pick, i) => {
    const price = escapeHtml(formatPrice(pick.price, pick.currency))
    return `${i + 1}. <a href="${escapeHtml(dealUrl(origin, pick.slug))}">${escapeHtml(truncate(pick.title, 120))}</a> · ${price}`
  })
  const assemble = (count: number) => [header, '', ...lines.slice(0, count), '', footer].join('\n')
  let count = lines.length
  while (count > 0 && Array.from(assemble(count)).length > MESSAGE_LIMIT) count--
  return assemble(count)
}

export function dropUrl(origin: string, dropSlug: string): string {
  return `${origin}/drops/${encodeURIComponent(dropSlug)}`
}

export const DROP_BUTTON_TEXT = 'See today’s drop'
