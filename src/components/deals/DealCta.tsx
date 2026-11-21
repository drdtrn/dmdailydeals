import { ArrowRight } from 'lucide-react'
import React from 'react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/utilities/ui'

import { goHref, storeOf, type DealView } from './dealView'

type Props = {
  deal: DealView
  label: string
  size?: 'default' | 'lg' | 'xl'
  variant?: 'default' | 'outline'
  arrow?: boolean
  className?: string
}

/**
 * The tracked outbound link: /go/<id> (302 to the store; logs the click). A plain <a>, not
 * next/link, so it is never prefetched (a prefetch would log a click). Marked sponsored.
 */
export function DealCta({
  deal,
  label,
  size = 'default',
  variant = 'default',
  arrow,
  className,
}: Props) {
  const store = storeOf(deal)
  return (
    <a
      href={goHref(deal)}
      rel="sponsored nofollow"
      aria-label={`${label}: ${deal.title}`}
      data-umami-event="deal-cta"
      data-umami-event-deal={deal.slug}
      data-umami-event-store={store?.slug}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {label}
      {arrow ? <ArrowRight aria-hidden="true" strokeWidth={1.75} /> : null}
    </a>
  )
}
