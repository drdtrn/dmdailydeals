/** Pure pagination helpers shared by the drop archive and the blog. */

export type PageParse = { ok: true; page: number } | { ok: false }

/**
 * Parse a `?page=` value. Missing means page 1. Anything that is not a plain positive integer
 * ("0", "-1", "2.5", "abc", "1e3", "٢") is rejected, so the caller can return a 404 instead of
 * silently serving page 1 under a junk URL.
 */
export function parsePageParam(raw: string | string[] | undefined | null): PageParse {
  if (raw === undefined || raw === null) return { ok: true, page: 1 }
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined || !/^[1-9]\d{0,5}$/.test(value)) return { ok: false }
  return { ok: true, page: Number(value) }
}

/** Number of pages for `total` items. An empty list still has one (empty) page. */
export function totalPagesFor(total: number, perPage: number): number {
  if (!Number.isFinite(total) || total <= 0 || perPage <= 0) return 1
  return Math.ceil(total / perPage)
}

/** True when `page` exists for `total` items. */
export function isPageInRange(page: number, total: number, perPage: number): boolean {
  return Number.isInteger(page) && page >= 1 && page <= totalPagesFor(total, perPage)
}

/**
 * The page numbers to show in a pager: first, last, and a window around the current page, with
 * `null` standing for a gap ("...").
 */
export function pageWindow(page: number, totalPages: number, radius = 1): (number | null)[] {
  const pages = new Set<number>([1, totalPages])
  for (let p = page - radius; p <= page + radius; p++) if (p >= 1 && p <= totalPages) pages.add(p)
  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | null)[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null)
    out.push(p)
  })
  return out
}
