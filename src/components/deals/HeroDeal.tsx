import Link from 'next/link'
import React from 'react'

import { formatPercentOff, percentOff } from '@/lib/format'
import { cn } from '@/utilities/ui'

import { DealCta } from './DealCta'
import { DealImage } from './DealImage'
import {
  categoryOf,
  dealHref,
  isUnavailable,
  storeOf,
  unavailableLabel,
  type DealView,
} from './dealView'
import { DisclosureNote } from './DisclosureNote'
import { LowestBadge } from './LowestBadge'
import { Price } from './Price'
import { PriceChecked } from './PriceChecked'

type Props = {
  deal: DealView
  lowestIn90Days?: boolean
  /** The home page uses "h1"; other pages should keep the default. */
  headingLevel?: 'h1' | 'h2'
  className?: string
}

/**
 * The hero deal of a drop. Meant to sit inside <HeroBand> (or any panel); it only uses
 * semantic tokens, so it works in any theme scope. The image is the
 * page's LCP element: next/image `preload` puts it in the head.
 */
export function HeroDeal({
  deal,
  lowestIn90Days = false,
  headingLevel: Heading = 'h2',
  className,
}: Props) {
  const store = storeOf(deal)
  const category = categoryOf(deal)
  const off = percentOff(deal.price, deal.wasPrice)
  const unavailable = isUnavailable(deal)
  const eyebrow = [store?.name, category?.title].filter(Boolean).join(' · ')

  return (
    <article
      data-state={unavailable ? deal.status : 'live'}
      className={cn('flex flex-wrap items-center gap-x-16 gap-y-6 md:gap-y-10', className)}
    >
      <DealImage
        image={deal.image}
        alt={deal.title}
        categorySlug={category?.slug}
        size="hero"
        sizes="(min-width: 1200px) 560px, (min-width: 768px) 50vw, 100vw"
        preload
        muted={unavailable}
        iconClassName="size-[104px] md:size-40"
        className="aspect-[4/3] min-w-0 flex-[1_1_460px] rounded-lg border border-border bg-card shadow-soft"
      >
        {unavailable ? (
          <span className="absolute top-3 left-3 rounded-xs bg-primary px-2.5 py-1 text-sm font-bold text-primary-foreground md:top-4 md:left-4 md:px-3 md:py-[5px] md:text-base">
            {unavailableLabel(deal)}
          </span>
        ) : off ? (
          <span className="absolute top-3 left-3 rounded-xs bg-deal px-2.5 py-1 text-sm font-bold text-deal-foreground md:top-4 md:left-4 md:px-3 md:py-[5px] md:text-base">
            {formatPercentOff(off)}
            <span className="sr-only"> off</span>
          </span>
        ) : null}
      </DealImage>

      <div className="min-w-0 flex-[1_1_400px]">
        <p className="mb-1.5 text-xs tracking-[0.14em] text-muted-foreground uppercase md:mb-2.5 md:tracking-[0.16em]">
          <span className="hidden md:inline">Hero deal · </span>
          {eyebrow}
        </p>
        <Heading className="font-display text-[30px] leading-[1.15] font-medium md:text-[clamp(32px,4vw,52px)] md:leading-[1.08]">
          <Link href={dealHref(deal)} className="hover:underline">
            {deal.title}
          </Link>
        </Heading>
        {deal.editorNote ? (
          <p className="mt-3 max-w-[520px] text-soft-foreground md:mt-[18px] md:text-[17px]">
            <strong className="font-semibold text-foreground">Why it&rsquo;s a deal:</strong>{' '}
            {deal.editorNote}
          </p>
        ) : null}

        <div className="mt-[18px] flex flex-wrap items-baseline gap-3 md:mt-[26px] md:gap-4">
          <Price
            price={deal.price}
            wasPrice={deal.wasPrice}
            currency={deal.currency}
            size="hero"
            muted={unavailable}
          />
          {lowestIn90Days && !unavailable ? <LowestBadge size="hero" /> : null}
        </div>
        <PriceChecked at={deal.priceCheckedAt} className="mt-2 md:mt-2.5 md:text-[13px]" />

        <div className="mt-5 flex flex-col gap-2.5 md:mt-7 md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-3.5">
          {unavailable ? (
            <Link
              href={dealHref(deal)}
              className="inline-flex h-[52px] items-center justify-center rounded-sm border border-primary bg-card px-7 font-semibold md:h-14"
            >
              This deal has ended: see details
            </Link>
          ) : (
            <DealCta
              deal={deal}
              label={`Get the deal${store ? ` at ${store.name}` : ''}`}
              size="lg"
              arrow
              className="w-full md:h-14 md:w-auto"
            />
          )}
          {unavailable ? null : <DisclosureNote className="text-center md:text-left" />}
        </div>
      </div>
    </article>
  )
}
