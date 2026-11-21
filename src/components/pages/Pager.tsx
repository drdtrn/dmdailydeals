import Link from 'next/link'
import React from 'react'

import { pageWindow } from '@/lib/pagination'
import { cn } from '@/utilities/ui'

type Props = {
  page: number
  totalPages: number
  /** URL of page `n`. Page 1 should be the clean, parameter-free URL. */
  hrefFor: (page: number) => string
  label?: string
  className?: string
}

const item =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-sm border px-3 text-sm font-medium'

/** Server-rendered pager made of real links, so it works without JavaScript and crawlers can follow it. */
export function Pager({ page, totalPages, hrefFor, label = 'Pagination', className }: Props) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label={label} className={cn('mt-10 md:mt-14', className)}>
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <li>
            <Link href={hrefFor(page - 1)} rel="prev" className={cn(item, 'border-border-strong')}>
              Previous
            </Link>
          </li>
        ) : null}
        {pageWindow(page, totalPages).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={cn(
                  item,
                  p === page
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border-strong hover:border-primary',
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        {page < totalPages ? (
          <li>
            <Link href={hrefFor(page + 1)} rel="next" className={cn(item, 'border-border-strong')}>
              Next
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
