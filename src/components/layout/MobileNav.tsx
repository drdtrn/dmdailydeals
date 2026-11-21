'use client'

import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import React from 'react'

import type { NavLink } from './nav'

/**
 * Phone menu, built on <details> so it works without JavaScript. Keying on the pathname
 * remounts it closed after each navigation (no effect, no state).
 */
export function MobileNav({ items }: { items: NavLink[] }) {
  const pathname = usePathname()

  return (
    <details key={pathname} className="group relative md:hidden">
      <summary
        aria-label="Menu"
        className="flex size-11 cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden"
      >
        <Menu aria-hidden="true" strokeWidth={1.5} className="size-6 group-open:hidden" />
        <X aria-hidden="true" strokeWidth={1.5} className="hidden size-6 group-open:block" />
      </summary>
      <nav
        aria-label="Menu"
        className="absolute top-full right-0 z-30 w-[min(20rem,calc(100vw-2.5rem))] border border-border bg-background py-2 text-foreground shadow-pop"
      >
        <ul>
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className="flex min-h-12 items-center px-5 text-base hover:bg-accent aria-[current=page]:font-semibold"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  )
}
