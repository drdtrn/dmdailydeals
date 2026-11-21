'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { cn } from '@/utilities/ui'

import type { NavLink } from './nav'

/** Desktop header navigation. Client only to mark the current page with aria-current. */
export function MainNav({ items, className }: { items: NavLink[]; className?: string }) {
  const pathname = usePathname()
  const isCurrent = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex flex-wrap gap-x-7">
        {items.map((item) => {
          const current = isCurrent(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                {...(item.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={cn(
                  'inline-flex min-h-11 items-center border-b text-[15px] transition-colors',
                  current
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-soft-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
