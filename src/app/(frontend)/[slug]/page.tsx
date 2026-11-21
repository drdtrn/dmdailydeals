import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { DealGrid } from '@/components/pages/DealGrid'
import { PageHeading } from '@/components/pages/PageHeading'
import { dealHref } from '@/components/deals/dealView'
import { JsonLd } from '@/components/seo/JsonLd'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { RenderHero } from '@/heros/RenderHero'
import { getEventBySlug, getPageBySlug } from '@/lib/data/content'
import { getLowestFlags } from '@/lib/data/deals'
import { formatDateRange } from '@/lib/format'
import { newestUpdatedAt } from '@/lib/freshness'
import { isEventIndexable } from '@/lib/seo/indexing'
import { buildBreadcrumbList, buildCollectionPage, buildOrganization } from '@/lib/seo/jsonld'
import { clipDescription, pageMetadata } from '@/lib/seo/meta'
import { ROOT_CRUMB, siteOrigin } from '@/lib/seo/site'
import { generateMeta } from '@/utilities/generateMeta'

/**
 * One dynamic segment serves two kinds of document: CMS pages (/about, /disclosure, ...) and event
 * hubs (/black-friday). A page wins over an event with the same slug; anything else is a 404.
 * Static routes (/esim, /blog, ...) always win over this segment.
 */
type Args = { params: Promise<{ slug?: string }> }

/** `decodeURIComponent` throws on malformed escapes ("%E0%A4%A"); treat those as an unknown slug. */
function decodeSlug(slug = ''): string {
  try {
    return decodeURIComponent(slug)
  } catch {
    return ''
  }
}

/** Draft mode (admin preview) reads the draft straight from Payload, uncached. */
const queryDraftPage = cache(async (slug: string) => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'pages',
    draft: true,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: { slug: { equals: slug } },
  })
  return result.docs?.[0] || null
})

async function loadPage(slug: string) {
  const { isEnabled: draft } = await draftMode()
  return draft ? queryDraftPage(slug) : getPageBySlug(slug)
}

export default async function Page({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const decodedSlug = decodeSlug((await paramsPromise).slug)
  const url = '/' + decodedSlug

  const page = await loadPage(decodedSlug)

  if (page) {
    const { hero, layout } = page
    return (
      <article className="pb-24">
        {/* Allows redirects for valid pages too */}
        <PayloadRedirects disableNotFound url={url} />
        {decodedSlug === 'about' ? <JsonLd data={buildOrganization(siteOrigin())} /> : null}
        {draft && <LivePreviewListener />}

        {/* The page title is the h1. Image heroes still render above the content. */}
        {hero?.type === 'highImpact' || hero?.type === 'mediumImpact' ? (
          <RenderHero {...hero} />
        ) : null}
        <div className="container">
          <PageHeading title={page.title} />
        </div>
        <RenderBlocks blocks={layout} />
      </article>
    )
  }

  const found = await getEventBySlug(decodedSlug)
  if (found) {
    const { event, deals } = found
    const lowest = await getLowestFlags(deals)
    const window = formatDateRange(event.startsAt, event.endsAt)
    const origin = siteOrigin()
    const crumbs = [ROOT_CRUMB, { label: event.name }]
    return (
      <div className="container pb-8">
        <JsonLd
          data={[
            buildBreadcrumbList(origin, crumbs, url),
            buildCollectionPage(origin, {
              name: `${event.name} deals`,
              description: event.intro,
              path: url,
              itemPaths: deals.map((deal) => dealHref(deal)),
            }),
          ]}
        />
        <PageHeading
          crumbs={crumbs}
          eyebrow={window ? `Event · ${window}` : 'Event'}
          title={`${event.name} deals`}
          lead={event.intro}
          updatedAt={newestUpdatedAt(deals, event.updatedAt)}
        />
        {deals.length > 0 ? (
          <>
            <DisclosureNote className="mb-6" />
            <DealGrid
              deals={deals}
              lowest={lowest}
              headingLevel="h2"
              label={`${event.name} deals`}
              eagerCount={2}
            />
          </>
        ) : (
          <p className="text-soft-foreground">
            We have not picked any {event.name} deals yet. Check back as the event gets closer.
          </p>
        )}
      </div>
    )
  }

  return <PayloadRedirects url={url} />
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const decodedSlug = decodeSlug((await paramsPromise).slug)
  const page = await loadPage(decodedSlug)
  if (page) return generateMeta({ doc: page, path: `/${decodedSlug}` })

  const found = await getEventBySlug(decodedSlug)
  if (found) {
    const { event } = found
    return pageMetadata({
      title: event.meta?.title || `${event.name} deals`,
      description:
        event.meta?.description ||
        clipDescription(event.intro) ||
        `Our picks for ${event.name}: ${formatDateRange(event.startsAt, event.endsAt)}.`,
      path: `/${decodedSlug}`,
      image: event.meta?.image,
      // Outside its window, an event hub needs evergreen original copy to stay in the index.
      noindex: !isEventIndexable(event),
    })
  }
  return {}
}
