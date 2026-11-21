import React from 'react'

import { formatPrice } from '@/lib/format'
import { cn } from '@/utilities/ui'

type Props = {
  price: number
  wasPrice?: number | null
  currency?: string
  /** "card" 22/26px, "hero" 42/56px. */
  size?: 'card' | 'hero'
  /** Dim the price (expired deals). */
  muted?: boolean
  className?: string
}

/** Price + struck-through was-price. Plain HTML (<s>); structured data lives elsewhere. */
export function Price({
  price,
  wasPrice,
  currency = 'USD',
  size = 'card',
  muted,
  className,
}: Props) {
  const showWas = typeof wasPrice === 'number' && wasPrice > price
  return (
    <div
      className={cn(
        'flex flex-wrap items-baseline',
        size === 'hero' ? 'gap-3 md:gap-4' : 'gap-2 md:gap-2.5',
        className,
      )}
    >
      <span
        className={cn(
          'font-display leading-none font-medium [font-variant-numeric:lining-nums]',
          size === 'hero' ? 'text-[42px] md:text-[56px]' : 'text-[22px] md:text-[26px]',
          muted && 'text-muted-foreground',
        )}
      >
        <span className="sr-only">Price </span>
        {formatPrice(price, currency)}
      </span>
      {showWas ? (
        <s
          className={cn(
            'text-subtle-foreground',
            size === 'hero' ? 'text-base md:text-lg' : 'text-[13px] md:text-sm',
          )}
        >
          <span className="sr-only">Was </span>
          {formatPrice(wasPrice, currency)}
        </s>
      ) : null}
    </div>
  )
}
