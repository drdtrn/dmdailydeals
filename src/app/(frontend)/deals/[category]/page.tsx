import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { CategoryNav } from '@/components/deals/CategoryNav'
import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { DealGrid } from '@/components/pages/DealGrid'
import { DropRow } from '@/components/pages/DropRow'
import { JsonLd } from '@/components/seo/JsonLd'
import { dealHref } from '@/components/deals/dealView'
import { PageHeading, PageSection } from '@/components/pages/PageHeading'
import { getLiveDealsByCategory, getLowestFlags } from '@/lib/data/deals'
import { getDropsForCategory } from '@/lib/data/drops'
import { getCategoryBySlug } from '@/lib/data/site'
import { newestUpdatedAt } from '@/lib/freshness'
import { buildBreadcrumbList, buildCollectionPage } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/meta'
import { ROOT_CRUMB, siteOrigin } from '@/lib/seo/site'

type Props = { params: Promise<{ category: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).category
  const category = await getCategoryBySlug(slug)
  if (!category) return {}
  return pageMetadata({
    title: category.meta?.title || `${category.title} deals`,
    description:
      category.meta?.description ||
      category.intro ||
      `Curated ${category.title.toLowerCase()} deals, with the price checked before we call something a deal.`,
    path: `/deals/${category.slug}`,
    image: category.meta?.image,
  })
}

export default async function CategoryPage({ params }: Props) {
  const slug = (await params).category
  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  const [deals, drops] = await Promise.all([
    getLiveDealsByCategory(category.id, category.slug),
    getDropsForCategory(category.id, category.slug),
  ])
  const lowest = await getLowestFlags(deals)
  const origin = siteOrigin()
  const path = `/deals/${category.slug}`
  const crumbs = [ROOT_CRUMB, { label: category.title }]

  return (
    <div className="container pb-8">
      <JsonLd
        data={[
          buildBreadcrumbList(origin, crumbs, path),
          buildCollectionPage(origin, {
            name: `${category.title} deals`,
            description: category.intro,
            path,
            itemPaths: deals.map((deal) => dealHref(deal)),
          }),
        ]}
      />
      <PageHeading
        crumbs={crumbs}
        eyebrow="Category"
        title={`${category.title} deals`}
        lead={category.intro}
        updatedAt={newestUpdatedAt(deals, category.updatedAt)}
      />
      <CategoryNav
        activeSlug={category.slug}
        leading={{ label: 'All', href: '/' }}
        label="Browse by category"
      />

      <PageSection title={`Live ${category.title.toLowerCase()} deals`}>
        {deals.length > 0 ? (
          <>
            <DisclosureNote className="mb-6" />
            <DealGrid
              deals={deals}
              lowest={lowest}
              label={`Live ${category.title} deals`}
              eagerCount={2}
            />
          </>
        ) : (
          <p className="text-soft-foreground">
            There are no live {category.title.toLowerCase()} deals right now. A new drop lands every
            day at 9:00 AM ET.
          </p>
        )}
      </PageSection>

      {drops.length > 0 ? (
        <PageSection title={`Recent drops with ${category.title.toLowerCase()} deals`}>
          <ul aria-label="Recent drops" className="border-t border-border">
            {drops.map((drop) => (
              <DropRow key={drop.slug} drop={drop} headingLevel="h3" />
            ))}
          </ul>
        </PageSection>
      ) : null}
    </div>
  )
}
