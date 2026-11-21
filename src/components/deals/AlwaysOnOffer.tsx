import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { buttonVariants } from '@/components/ui/button'
import type { AlwaysOnOffer as AlwaysOnOfferGlobal } from '@/payload-types'
import { cn } from '@/utilities/ui'

type Props = {
  /** The `always-on-offer` global (or a slice of it). */
  offer: Pick<AlwaysOnOfferGlobal, 'title' | 'partner' | 'code'>
  /** Where the CTA goes. The landing page is /esim; the partner link lives there. */
  href?: string
  ctaLabel?: string
  description?: string
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/** The permanent "deal that never expires" slot (the eSIM offer). */
export function AlwaysOnOffer({
  offer,
  href = '/esim',
  ctaLabel = 'See eSIM plans',
  description = 'Mobile data for your next trip, set up before you fly.',
  headingLevel: Heading = 'h2',
  className,
}: Props) {
  return (
    <section
      aria-label="The deal that never expires"
      className={cn(
        'flex min-w-0 flex-col rounded-lg border border-border bg-card p-6 shadow-soft md:p-9',
        className,
      )}
    >
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
        The deal that never expires
      </p>
      <Heading className="mt-2 font-display text-[30px] leading-[1.15] font-medium md:mt-2.5 md:text-4xl md:leading-[1.1]">
        {offer.title}
      </Heading>
      <p className="mt-2.5 max-w-[460px] text-soft-foreground md:mt-3.5">
        {description}
        {offer.code ? (
          <>
            {' '}
            Use code{' '}
            <strong className="font-bold tracking-[0.06em] text-foreground">{offer.code}</strong> at
            checkout.
          </>
        ) : null}
      </p>
      <div className="mt-[18px] md:mt-auto md:pt-[18px]">
        <Link
          href={href}
          className={cn(buttonVariants({ size: 'lg' }), 'w-full md:h-[50px] md:w-auto md:px-6')}
        >
          {ctaLabel}
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  )
}
