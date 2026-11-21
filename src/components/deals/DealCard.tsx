import Link from 'next/link'
import React from 'react'

import { buttonVariants } from '@/components/ui/button'
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
import { LowestBadge } from './LowestBadge'
import { Price } from './Price'
import { PriceChecked } from './PriceChecked'

type Props = {
  deal: DealView
  /** Show "Lowest in 90 days" only when the price-snapshot data supports it. */
  lowestIn90Days?: boolean
  /** First row of a list: load the image eagerly. */
  eager?: boolean
  /** Heading level for the title, so the card fits any page outline. */
  headingLevel?: 'h2' | 'h3' | 'h4'
  className?: string
}

/** Calm editorial card for one deal (server component). */
export function DealCard({
  deal,
  lowestIn90Days = false,
  eager = false,
  headingLevel: Heading = 'h3',
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
      className={cn('flex min-w-0 flex-col', className)}
    >
      <Link href={dealHref(deal)} tabIndex={-1} aria-hidden="true" className="block">
        <DealImage
          image={deal.image}
          alt=""
          categorySlug={category?.slug}
          sizes="(min-width: 1280px) 280px, (min-width: 768px) 25vw, 50vw"
          eager={eager}
          muted={unavailable}
          className="aspect-square"
        >
          {unavailable ? (
            <span className="absolute top-2 left-2 rounded-xs bg-primary px-[7px] py-0.5 text-xs font-bold text-primary-foreground md:top-2.5 md:left-2.5 md:px-2 md:py-[3px] md:text-[13px]">
              {unavailableLabel(deal)}
            </span>
          ) : off ? (
            <span className="absolute top-2 left-2 rounded-xs bg-deal px-[7px] py-0.5 text-xs font-bold text-deal-foreground md:top-2.5 md:left-2.5 md:px-2 md:py-[3px] md:text-[13px]">
              {formatPercentOff(off)}
              <span className="sr-only"> off</span>
            </span>
          ) : null}
        </DealImage>
      </Link>

      {eyebrow ? (
        <p className="mt-2.5 mb-0.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase md:mt-3.5 md:mb-1">
          {eyebrow}
        </p>
      ) : null}
      <Heading className="min-h-[39px] text-[15px] leading-[1.3] font-semibold md:min-h-[43px] md:text-base md:leading-[1.35]">
        <Link href={dealHref(deal)} className="hover:underline">
          {deal.title}
        </Link>
      </Heading>

      <Price
        price={deal.price}
        wasPrice={deal.wasPrice}
        currency={deal.currency}
        muted={unavailable}
        className="mt-2 md:mt-2.5"
      />

      {lowestIn90Days && !unavailable ? (
        <LowestBadge className="mt-2 self-start md:mt-2.5" />
      ) : null}
      <PriceChecked at={deal.priceCheckedAt} className="mt-2" />

      <div className="mt-auto pt-3 md:pt-3.5">
        {unavailable ? (
          <Link
            href={dealHref(deal)}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
          >
            View details
            <span className="sr-only">: {deal.title}</span>
          </Link>
        ) : (
          <DealCta
            deal={deal}
            label="Get deal"
            variant="outline"
            size="default"
            className="min-h-11 h-auto w-full text-sm"
          />
        )}
      </div>
    </article>
  )
}
