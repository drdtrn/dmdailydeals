import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { DropRow } from '@/components/pages/DropRow'
import { PageHeading } from '@/components/pages/PageHeading'
import { Pager } from '@/components/pages/Pager'
import { DROPS_PER_PAGE, listDrops } from '@/lib/data/drops'
import { isPageInRange, parsePageParam } from '@/lib/pagination'
import { pageMetadata } from '@/lib/seo/meta'

type Props = { searchParams: Promise<{ page?: string | string[] }> }

const hrefFor = (page: number) => (page <= 1 ? '/drops' : `/drops?page=${page}`)

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const parsed = parsePageParam((await searchParams).page)
  const page = parsed.ok ? parsed.page : 1
  return pageMetadata({
    title: page > 1 ? `Deal drop archive, page ${page}` : 'Deal drop archive',
    description:
      'Every daily drop of curated deals across home, tech and travel, newest first, each with its hero deal and picks.',
    path: hrefFor(page),
  })
}

export default async function DropsPage({ searchParams }: Props) {
  const parsed = parsePageParam((await searchParams).page)
  if (!parsed.ok) notFound()

  const { items, totalDocs, totalPages } = await listDrops(parsed.page)
  // A page past the end is a 404, but an empty archive still has a page 1.
  if (
    !isPageInRange(parsed.page, totalDocs, DROPS_PER_PAGE) ||
    (items.length === 0 && parsed.page > 1)
  ) {
    notFound()
  }

  return (
    <div className="container pb-8">
      <PageHeading
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Drops' }]}
        title="Deal drop archive"
        lead="One hero deal and a set of curated picks, published every day at 9:00 AM ET. Open a day to see what dropped and which deals were the real thing."
      />
      {items.length > 0 ? (
        <ul aria-label="Drops, newest first" className="border-t border-border">
          {items.map((drop, index) => (
            <DropRow key={drop.slug} drop={drop} eager={index < 2} />
          ))}
        </ul>
      ) : (
        <p className="text-soft-foreground">No drops have been published yet.</p>
      )}
      <Pager
        page={parsed.page}
        totalPages={totalPages}
        hrefFor={hrefFor}
        label="Drop archive pages"
      />
    </div>
  )
}
