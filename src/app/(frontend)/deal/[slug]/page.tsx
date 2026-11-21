import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { isUnavailable } from '@/components/deals/dealView'
import { DealDetail } from '@/components/pages/DealDetail'
import { DealGrid } from '@/components/pages/DealGrid'
import { PageSection } from '@/components/pages/PageHeading'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { JsonLd } from '@/components/seo/JsonLd'
import { categoryHref } from '@/lib/categories'
import { getDealBySlug, getLowestFlags, getRelatedDeals } from '@/lib/data/deals'
import { relId } from '@/lib/relId'
import { buildBreadcrumbList, buildProduct } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/meta'
import { ROOT_CRUMB, siteOrigin } from '@/lib/seo/site'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const deal = await getDealBySlug((await params).slug)
  if (!deal) return {}
  const unavailable = isUnavailable(deal)
  const meta = deal.meta
  return pageMetadata({
    title: meta?.title || (unavailable ? `${deal.title} (ended)` : deal.title),
    description: meta?.description || deal.editorNote,
    path: `/deal/${deal.slug}`,
    image: meta?.image ?? deal.image,
  })
}

export default async function DealPage({ params }: Props) {
  const deal = await getDealBySlug((await params).slug)
  if (!deal) notFound()

  const category = typeof deal.category === 'object' ? deal.category : null
  const categoryId = relId(deal.category) as number | undefined
  const unavailable = isUnavailable(deal)

  const related =
    category && categoryId !== undefined
      ? await getRelatedDeals(categoryId, category.slug, deal.id, 4)
      : []
  const lowest = await getLowestFlags([deal, ...related])

  const crumbs = [
    ROOT_CRUMB,
    ...(category ? [{ label: category.title, href: categoryHref(category.slug) }] : []),
    { label: deal.title },
  ]

  const origin = siteOrigin()
  const path = `/deal/${deal.slug}`

  return (
    <div className="container pb-8">
      <JsonLd
        data={[
          // Product only while the deal is live; expired and sold-out pages keep the breadcrumb only.
          buildProduct(origin, deal),
          buildBreadcrumbList(origin, crumbs, path),
        ]}
      />
      <Breadcrumbs items={crumbs} className="pt-8 pb-6 md:pt-10 md:pb-8" />
      <DealDetail deal={deal} lowestIn90Days={Boolean(lowest[String(deal.id)])} />

      {deal.editorNote ? (
        <section aria-labelledby="why-heading" className="mt-10 md:mt-14">
          <h2 id="why-heading" className="font-display text-3xl font-medium md:text-4xl">
            Why it’s a deal
          </h2>
          <div className="mt-4 max-w-[62ch] space-y-4 text-soft-foreground md:text-[17px]">
            {deal.editorNote
              .split(/\n{2,}/)
              .filter((p) => p.trim())
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 && category ? (
        <PageSection
          title={
            unavailable
              ? `Live ${category.title.toLowerCase()} deals instead`
              : `More ${category.title.toLowerCase()} deals`
          }
        >
          <DisclosureNote className="mb-6" />
          <DealGrid
            deals={related}
            lowest={lowest}
            headingLevel="h3"
            label={`More ${category.title} deals`}
          />
        </PageSection>
      ) : null}
    </div>
  )
}
