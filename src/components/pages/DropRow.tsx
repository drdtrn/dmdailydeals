import Link from 'next/link'
import React from 'react'

import { DealImage } from '@/components/deals/DealImage'
import { formatFullDate } from '@/lib/format'
import type { DropListItem } from '@/lib/data/drops'

/** One entry of a drop list: date, hero thumbnail, hero title, number of deals. */
export function DropRow({
  drop,
  eager = false,
  headingLevel: Heading = 'h2',
}: {
  drop: DropListItem
  eager?: boolean
  headingLevel?: 'h2' | 'h3'
}) {
  const href = `/drops/${drop.slug}`
  const category = drop.hero && typeof drop.hero.category === 'object' ? drop.hero.category : null
  return (
    <li className="min-w-0">
      <article className="flex items-center gap-4 border-b border-border py-4 md:gap-6 md:py-5">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="block w-24 shrink-0 md:w-40">
          <DealImage
            image={drop.hero?.image}
            alt=""
            categorySlug={category?.slug}
            sizes="(min-width: 768px) 160px, 96px"
            eager={eager}
            className="aspect-[4/3]"
          />
        </Link>
        <div className="min-w-0">
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
            <time dateTime={drop.slug}>{formatFullDate(drop.date)}</time>
          </p>
          <Heading className="mt-1 font-display text-xl leading-tight font-medium md:text-2xl">
            <Link href={href} className="hover:underline">
              {drop.hero?.title ?? `Drop of ${drop.slug}`}
            </Link>
          </Heading>
          <p className="mt-1 text-sm text-muted-foreground">
            {drop.pickCount} {drop.pickCount === 1 ? 'deal' : 'deals'}
          </p>
        </div>
      </article>
    </li>
  )
}
