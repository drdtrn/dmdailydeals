import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { DealGrid } from '@/components/pages/DealGrid'
import { PageHeading, PageSection } from '@/components/pages/PageHeading'
import { getLowestFlags } from '@/lib/data/deals'
import { getStoreBySlug, getStoreDeals } from '@/lib/data/content'
import { pageMetadata } from '@/lib/seo/meta'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await getStoreBySlug((await params).slug)
  if (!store) return {}
  const { total } = await getStoreDeals(store.id, store.slug)
  // Same rule as the page: a store without published deals has no hub (it 404s).
  if (total === 0) return {}
  return pageMetadata({
    title: store.meta?.title || `${store.name} deals`,
    description:
      store.meta?.description ||
      store.description ||
      `Current and recent ${store.name} deals we have picked and checked.`,
    path: `/stores/${store.slug}`,
    image: store.meta?.image ?? store.logo,
  })
}

export default async function StorePage({ params }: Props) {
  const store = await getStoreBySlug((await params).slug)
  if (!store) notFound()

  const { live, recent, total } = await getStoreDeals(store.id, store.slug)
  // No empty hub pages: a store with nothing published is not a page worth indexing.
  if (total === 0) notFound()

  const lowest = await getLowestFlags([...live, ...recent])

  return (
    <div className="container pb-8">
      <PageHeading
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Stores' }, { label: store.name }]}
        eyebrow="Store"
        title={`${store.name} deals`}
        lead={store.description}
      />

      <PageSection title={`Live ${store.name} deals`} className="mt-0 md:mt-0">
        {live.length > 0 ? (
          <>
            <DisclosureNote className="mb-6" />
            <DealGrid
              deals={live}
              lowest={lowest}
              label={`Live ${store.name} deals`}
              eagerCount={2}
            />
          </>
        ) : (
          <p className="text-soft-foreground">
            No live deals from {store.name} right now. See the recent ones below, or check back at
            the next drop.
          </p>
        )}
      </PageSection>

      {recent.length > 0 ? (
        <PageSection title="Recently ended">
          <DealGrid deals={recent} label={`Recently ended ${store.name} deals`} />
        </PageSection>
      ) : null}
    </div>
  )
}
