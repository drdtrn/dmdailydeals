import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { cn } from '@/utilities/ui'

export type Crumb = { label: string; href?: string }

/** Visual breadcrumb trail. (BreadcrumbList JSON-LD is added by the SEO layer in Phase 6.) */
export function Breadcrumbs({
  items,
  label = 'Breadcrumb',
  className,
}: {
  items: Crumb[]
  /** Accessible name; make it unique if two trails share a page. */
  label?: string
  className?: string
}) {
  if (items.length === 0) return null
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-6 items-center underline-offset-2 hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cn(last && 'text-foreground')}
                >
                  {item.label}
                </span>
              )}
              {!last ? (
                <ChevronRight aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
