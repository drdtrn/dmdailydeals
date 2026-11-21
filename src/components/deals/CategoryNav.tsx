import Link from 'next/link'
import React from 'react'

import { CATEGORY_LINKS, categoryHref, type CategoryLink } from '@/lib/categories'
import { cn } from '@/utilities/ui'

type Props = {
  /** Defaults to the launch categories (home, tech, travel). */
  categories?: readonly CategoryLink[]
  /** Slug of the category being viewed, marked with aria-current. */
  activeSlug?: string
  /** "pills" (filter-style chips, light page) or "links" (plain header links). */
  variant?: 'pills' | 'links'
  /** Adds a leading link, e.g. { label: 'All', href: '/' }. */
  leading?: { label: string; href: string; active?: boolean }
  /** Accessible name of the landmark; make it unique if the nav appears twice on a page. */
  label?: string
  className?: string
}

/** Links to /deals/<slug>. Server component: the active state comes from props, not the router. */
export function CategoryNav({
  categories = CATEGORY_LINKS,
  activeSlug,
  variant = 'pills',
  leading,
  label = 'Categories',
  className,
}: Props) {
  const items = [
    ...(leading ? [{ label: leading.label, href: leading.href, active: !!leading.active }] : []),
    ...categories.map((c) => ({
      label: c.label,
      href: categoryHref(c.slug),
      active: c.slug === activeSlug,
    })),
  ]

  return (
    <nav aria-label={label} className={className}>
      <ul className={cn('flex gap-2', variant === 'links' && 'gap-x-7')}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                variant === 'pills'
                  ? cn(
                      'inline-flex h-11 items-center rounded-full border px-[18px] text-sm whitespace-nowrap transition-colors',
                      item.active
                        ? 'border-primary bg-primary font-semibold text-primary-foreground'
                        : 'border-border-strong bg-card font-medium text-foreground hover:border-primary',
                    )
                  : cn(
                      'inline-flex min-h-11 items-center border-b border-transparent text-[15px] transition-colors',
                      item.active
                        ? 'border-foreground text-foreground'
                        : 'text-soft-foreground hover:text-foreground',
                    ),
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
