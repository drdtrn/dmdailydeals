import { Check } from 'lucide-react'
import React from 'react'

import { cn } from '@/utilities/ui'

/**
 * "Lowest in 90 days". Render it only when price-snapshot data supports the claim; the caller
 * decides (DealCard / HeroDeal take a boolean prop).
 */
export function LowestBadge({
  size = 'card',
  className,
}: {
  size?: 'card' | 'hero'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border text-foreground',
        size === 'hero'
          ? 'gap-1.5 border-border-strong px-[9px] py-1 text-xs md:px-[11px] md:py-[5px] md:text-[13px]'
          : 'gap-1 border-primary px-2 py-0.5 text-[11px] md:gap-[5px] md:px-[9px] md:text-xs',
        className,
      )}
    >
      <Check
        aria-hidden="true"
        strokeWidth={size === 'hero' ? 2.5 : 3}
        className={size === 'hero' ? 'size-3 md:size-[13px]' : 'size-2.5 md:size-[11px]'}
      />
      Lowest in 90 days
    </span>
  )
}
