/** Launch categories (decision: Home, Tech, Travel). Slugs match the seeded `categories`. */
export const CATEGORY_LINKS = [
  { slug: 'home', label: 'Home' },
  { slug: 'tech', label: 'Tech' },
  { slug: 'travel', label: 'Travel' },
] as const

export type CategoryLink = { slug: string; label: string }

export const categoryHref = (slug: string) => `/deals/${slug}`
