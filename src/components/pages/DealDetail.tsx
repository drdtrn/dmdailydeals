import Link from 'next/link'
import React from 'react'

import { DealCta } from '@/components/deals/DealCta'
import { DealImage } from '@/components/deals/DealImage'
import { categoryOf, isUnavailable, storeOf, unavailableLabel } from '@/components/deals/dealView'
import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { LowestBadge } from '@/components/deals/LowestBadge'
import { Price } from '@/components/deals/Price'
import { PriceChecked } from '@/components/deals/PriceChecked'
import { categoryHref } from '@/lib/categories'
import { formatDropAt, formatPercentOff, percentOff } from '@/lib/format'
import type { Deal } from '@/payload-types'

/**
 * The deal detail block: image, price, coupon, freshness, and the CTA with its disclosure right
 * next to it. An expired or sold-out deal gets a clear unavailable state and no buy CTA, but keeps
 * everything else so the page stays useful (and indexable).
 */
export function DealDetail({ deal, lowestIn90Days }: { deal: Deal; lowestIn90Days: boolean }) {
  const store = storeOf(deal)
  const category = categoryOf(deal)
  const off = percentOff(deal.price, deal.wasPrice)
  const unavailable = isUnavailable(deal)

  return (
    <article
      data-state={unavailable ? deal.status : 'live'}
      className="flex flex-wrap items-start gap-x-14 gap-y-8"
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
        className="aspect-[4/3] min-w-0 flex-[1_1_440px]"
      >
        {unavailable ? (
          <span className="absolute top-3 left-3 rounded-xs bg-primary px-2.5 py-1 text-sm font-bold text-primary-foreground md:top-4 md:left-4 md:text-base">
            {unavailableLabel(deal)}
          </span>
        ) : off ? (
          <span className="absolute top-3 left-3 rounded-xs bg-deal px-2.5 py-1 text-sm font-bold text-deal-foreground md:top-4 md:left-4 md:text-base">
            {formatPercentOff(off)}
            <span className="sr-only"> off</span>
          </span>
        ) : null}
      </DealImage>

      <div className="min-w-0 flex-[1_1_380px]">
        <p className="mb-2 text-xs tracking-[0.14em] text-muted-foreground uppercase">
          {store ? (
            <Link href={`/stores/${store.slug}`} className="hover:underline">
              {store.name}
            </Link>
          ) : null}
          {store && category ? ' · ' : null}
          {category ? (
            <Link href={categoryHref(category.slug)} className="hover:underline">
              {category.title}
            </Link>
          ) : null}
        </p>
        <h1 className="font-display text-[32px] leading-[1.12] font-medium text-balance md:text-5xl">
          {deal.title}
        </h1>

        {unavailable ? (
          <p
            data-testid="unavailable-note"
            className="mt-5 rounded-sm border border-primary px-4 py-3 text-[15px]"
          >
            <strong className="font-semibold">
              {deal.status === 'sold-out' ? 'This deal is sold out.' : 'This deal has ended.'}
            </strong>{' '}
            The price below is the last one we recorded. See the live{' '}
            {category?.title.toLowerCase() ?? ''} deals further down for current alternatives.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-baseline gap-3 md:gap-4">
          <Price
            price={deal.price}
            wasPrice={deal.wasPrice}
            currency={deal.currency}
            size="hero"
            muted={unavailable}
          />
          {off && !unavailable ? (
            <span className="text-lg font-semibold">
              {formatPercentOff(off)}
              <span className="sr-only"> off</span>
            </span>
          ) : null}
          {lowestIn90Days && !unavailable ? <LowestBadge size="hero" /> : null}
        </div>
        <PriceChecked at={deal.priceCheckedAt} className="mt-2 md:mt-2.5 md:text-[13px]" />
        {!unavailable && deal.expiresAt ? (
          <p className="mt-1 text-[11px] text-subtle-foreground md:text-[13px]">
            Offer runs until <time dateTime={deal.expiresAt}>{formatDropAt(deal.expiresAt)}</time>{' '}
            or while stock lasts.
          </p>
        ) : null}

        {!unavailable && deal.couponCode ? (
          <p className="mt-5">
            <span className="text-sm text-muted-foreground">Coupon code </span>
            <code className="rounded-xs border border-dashed border-border-strong px-2.5 py-1 font-mono text-base font-bold tracking-[0.06em]">
              {deal.couponCode}
            </code>
          </p>
        ) : null}

        {!unavailable ? (
          <div className="mt-6 flex flex-col gap-2.5 md:mt-8">
            <DealCta
              deal={deal}
              label={`Get the deal${store ? ` at ${store.name}` : ''}`}
              size="lg"
              arrow
              className="w-full md:h-14 md:w-auto md:self-start"
            />
            <DisclosureNote />
          </div>
        ) : null}
      </div>
    </article>
  )
}
