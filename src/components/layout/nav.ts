import { CATEGORY_LINKS, categoryHref } from '@/lib/categories'
import { docHref } from '@/lib/docHref'
import type { Footer, Header } from '@/payload-types'

export type NavLink = { label: string; href: string; newTab?: boolean }

/** Core site navigation: today's drop, the launch categories, the eSIM slot, the blog. */
export const PRIMARY_NAV: NavLink[] = [
  { label: 'Today', href: '/' },
  ...CATEGORY_LINKS.map((c) => ({ label: c.label, href: categoryHref(c.slug) })),
  { label: 'eSIM', href: '/esim' },
  { label: 'Blog', href: '/blog' },
]

/** Legal and trust pages (all are `pages` documents, see the seed). */
export const LEGAL_NAV: NavLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Affiliate disclosure', href: '/disclosure' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
]

type CmsNavItems = Header['navItems'] | Footer['navItems']

/**
 * Turn the `header` / `footer` global's navItems into plain links. Reference links resolve to
 * /<slug> for pages and /<collection>/<slug> otherwise; entries that cannot resolve are dropped.
 */
export function cmsLinks(items: CmsNavItems): NavLink[] {
  const out: NavLink[] = []
  for (const { link } of items ?? []) {
    const ref = link.reference
    const href =
      link.type === 'reference' && ref && typeof ref.value === 'object' && ref.value.slug
        ? docHref(ref.relationTo, ref.value.slug)
        : link.url
    if (!href || !link.label) continue
    out.push({ label: link.label, href, newTab: !!link.newTab })
  }
  return out
}
