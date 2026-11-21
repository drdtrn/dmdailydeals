import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { getCachedGlobal } from '@/utilities/getGlobals'

import { cmsLinks, LEGAL_NAV } from './nav'

/** Site footer: logo, the affiliate disclosure line, legal links (plus any `footer` global links). */
export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()
  const items = [...LEGAL_NAV, ...cmsLinks(footerData?.navItems)]
  const year = new Date().getFullYear()

  return (
    <footer className="mt-12 border-t border-border md:mt-20">
      <div className="container flex flex-wrap justify-between gap-x-12 gap-y-6 py-8 pb-10 md:py-10 md:pb-12">
        <div className="min-w-0 flex-[1_1_360px]">
          <Logo tone="auto" href="/" />
          <p className="mt-4 max-w-[440px] text-xs text-muted-foreground md:text-[13px]">
            DMDailyDeals earns a commission on some purchases made through links on this site.
            Prices change often, so check the store before you buy.{' '}
            <Link href="/disclosure" className="text-foreground underline underline-offset-2">
              Affiliate disclosure
            </Link>
          </p>
          <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground md:text-[13px]">
            <p>&copy; {year} DMDailyDeals</p>
            <ThemeToggle className="inline-flex size-11 items-center justify-center rounded-full border border-border-strong text-foreground hover:border-primary" />
          </div>
        </div>
        <nav aria-label="Footer" className="content-start">
          <ul className="flex flex-wrap gap-x-5 text-sm md:gap-x-7">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  {...(item.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex min-h-11 items-center hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
