import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/brand/Logo'
import { buttonVariants } from '@/components/ui/button'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { cn } from '@/utilities/ui'

import { MainNav } from './MainNav'
import { MobileNav } from './MobileNav'
import { cmsLinks, PRIMARY_NAV } from './nav'

/**
 * Site header: a white, slightly translucent sticky bar with a hairline underneath. Links come from the code-defined primary nav plus any
 * extra entries an editor adds to the `header` global.
 */
export async function Header() {
  const headerData = await getCachedGlobal('header', 1)()
  const items = [...PRIMARY_NAV, ...cmsLinks(headerData?.navItems)]

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/85 text-foreground backdrop-blur">
      <div className="container">
        <div className="flex h-16 items-center justify-between gap-x-8 md:min-h-20">
          <Logo tone="auto" href="/" eager />
          <MainNav items={items} className="hidden md:block" />
          <Link
            href="/#newsletter"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'hidden md:inline-flex',
            )}
          >
            Get the drop by email
          </Link>
          <MobileNav items={items} />
        </div>
      </div>
    </header>
  )
}
