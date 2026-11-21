import type {
  Article,
  BlogPosting,
  BreadcrumbList,
  CollectionPage,
  ItemList,
  Organization,
  Product,
  Thing,
  WebSite,
  WithContext,
} from 'schema-dts'

import type { Media } from '@/payload-types'

import { resolveImage } from '@/lib/media'

import { absoluteUrl, DEFAULT_OG_IMAGE_PATH, LOGO_PATH, SITE_NAME } from './site'

/**
 * JSON-LD builders (plan section C). Pure: no I/O, no clock unless `now` is passed, no reading of
 * the environment. Every URL is absolute and rooted at `origin`.
 *
 * What is deliberately NOT here: FAQPage, HowTo, Event (sales are ineligible), the sitelinks search
 * box, AggregateOffer, `aggregateRating`/`review`, strikethrough prices and merchant-only
 * properties (return policy, shipping). Structured data must match the visible text, so the
 * was-price stays in the HTML only. The unit tests assert none of those ever appear.
 */

type Doc<T extends Thing> = WithContext<T>

/** Serialise for a `<script type="application/ld+json">`; `<` is escaped so `</script>` cannot occur. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

/** An absolute image URL from a populated media doc: the given size, else the original. */
export function mediaAbsoluteUrl(
  origin: string,
  media: Media | number | null | undefined,
  size: 'card' | 'hero' | 'og' | 'original' = 'hero',
): string | undefined {
  const image = resolveImage(media, size)
  return image ? absoluteUrl(image.src, origin) : undefined
}

// --- Organization and website ---------------------------------------------------------------------

type OrganizationNode = Extract<Organization, { '@type': 'Organization' }>

/** `logo` is a plain URL: the file is 669 px wide (Google asks for at least 112 px). */
export function organizationNode(origin: string): OrganizationNode {
  return {
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/', origin),
    logo: absoluteUrl(LOGO_PATH, origin),
  }
}

export function buildOrganization(origin: string): Doc<Organization> {
  return { '@context': 'https://schema.org', ...organizationNode(origin) }
}

/** Home page only. No `potentialAction`: the sitelinks search box is retired. */
export function buildWebSite(origin: string): Doc<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: absoluteUrl('/', origin),
  }
}

// --- Breadcrumbs ----------------------------------------------------------------------------------

export type JsonLdCrumb = { label: string; href?: string }

/**
 * The same trail the page shows. The last crumb is the current page: it has no link on screen, so
 * `currentPath` gives it its URL. Intermediate crumbs without a link cannot be a `ListItem` and are
 * skipped (pages should not render them).
 */
export function buildBreadcrumbList(
  origin: string,
  crumbs: readonly JsonLdCrumb[],
  currentPath: string,
): Doc<BreadcrumbList> {
  const items = crumbs.flatMap((crumb, index) => {
    const last = index === crumbs.length - 1
    const href = last ? currentPath : crumb.href
    return href ? [{ name: crumb.label, href }] : []
  })
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href, origin),
    })),
  }
}

// --- Deals ----------------------------------------------------------------------------------------

export type ProductInput = {
  title: string
  slug: string
  /** The original editor note; it is visible on the page, so it is the description. */
  editorNote?: string | null
  price: number
  currency: string
  status: 'draft' | 'live' | 'expired' | 'sold-out'
  expiresAt?: string | null
  image?: Media | number | null
}

/**
 * Product snippet markup for a deal page. Only for a live deal: an expired or sold-out deal returns
 * null (no Product), so the page stays indexable without advertising an offer that is gone.
 * `url` points to the canonical deal page, never to `/go/...` (robots disallows it).
 */
export function buildProduct(
  origin: string,
  deal: ProductInput,
  now: Date = new Date(),
): Doc<Product> | null {
  if (deal.status !== 'live') return null
  const url = absoluteUrl(`/deal/${deal.slug}`, origin)
  const image = mediaAbsoluteUrl(origin, deal.image)
  const description = clean(deal.editorNote)

  // A past `priceValidUntil` can suppress the snippet, so it is omitted rather than sent stale.
  const expires = deal.expiresAt ? new Date(deal.expiresAt) : null
  const validUntil =
    expires && !Number.isNaN(expires.getTime()) && expires.getTime() > now.getTime()
      ? expires.toISOString()
      : undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: deal.title,
    ...(image ? { image: [image] } : {}),
    ...(description ? { description } : {}),
    url,
    offers: {
      '@type': 'Offer',
      url,
      price: deal.price,
      priceCurrency: deal.currency,
      availability: 'https://schema.org/InStock',
      ...(validUntil ? { priceValidUntil: validUntil } : {}),
    },
  }
}

// --- Drops, lists and hubs --------------------------------------------------------------------------

export type ArticleInput = {
  headline: string
  description?: string | null
  /** Canonical path, e.g. "/drops/2026-11-21". */
  path: string
  datePublished: string
  dateModified: string
  image?: Media | number | null
}

/** A dated drop page. The author and the publisher are the Organization. */
export function buildArticle(origin: string, input: ArticleInput): Doc<Article> {
  const url = absoluteUrl(input.path, origin)
  const description = clean(input.description)
  const published = new Date(input.datePublished).toISOString()
  const modified = new Date(input.dateModified)
  const dateModified = (
    modified.getTime() < new Date(published).getTime() ? new Date(published) : modified
  ).toISOString()
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    ...(description ? { description } : {}),
    mainEntityOfPage: url,
    url,
    image: [
      mediaAbsoluteUrl(origin, input.image, 'og') ?? absoluteUrl(DEFAULT_OG_IMAGE_PATH, origin),
    ],
    datePublished: published,
    dateModified,
    author: organizationNode(origin),
    publisher: organizationNode(origin),
  }
}

export type BlogPostingInput = ArticleInput & {
  /** The category name, as `articleSection`. */
  section?: string | null
  /** A real, named author. Without one the Organization is the author. */
  author?: { name: string; sameAs?: readonly string[] } | null
}

/**
 * A blog post. The author is a `Person` (name and profile links) when the post has a byline, else
 * the Organization; the publisher is always the Organization. There are no properties about how
 * the content was produced.
 */
export function buildBlogPosting(origin: string, input: BlogPostingInput): Doc<BlogPosting> {
  const {
    author: _author,
    publisher: _publisher,
    '@context': _context,
    ...article
  } = buildArticle(origin, input)
  const sameAs = (input.author?.sameAs ?? []).filter(Boolean)
  return {
    '@context': 'https://schema.org',
    ...article,
    '@type': 'BlogPosting',
    ...(input.section ? { articleSection: input.section } : {}),
    author: input.author
      ? {
          '@type': 'Person',
          name: input.author.name,
          ...(sameAs.length > 0 ? { sameAs: [...sameAs] } : {}),
        }
      : organizationNode(origin),
    publisher: organizationNode(origin),
  } as Doc<BlogPosting>
}

/** An ordered list of page URLs. No rich result, but it tells crawlers what the page lists. */
export function buildItemList(
  origin: string,
  name: string,
  paths: readonly string[],
): Doc<ItemList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: paths.length,
    itemListElement: paths.map((path, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(path, origin),
    })),
  }
}

export type CollectionPageInput = {
  name: string
  description?: string | null
  path: string
  itemPaths: readonly string[]
}

/** A hub page (category, store, event) with the deals it lists. */
export function buildCollectionPage(
  origin: string,
  input: CollectionPageInput,
): Doc<CollectionPage> {
  const description = clean(input.description)
  const { '@context': _context, ...list } = buildItemList(origin, input.name, input.itemPaths)
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    ...(description ? { description } : {}),
    url: absoluteUrl(input.path, origin),
    ...(input.itemPaths.length > 0 ? { mainEntity: list } : {}),
  }
}
