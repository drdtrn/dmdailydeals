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
 * Site header: always ink (dark scope) in both themes, so it joins the hero band on the home
 * page and acts as a masthead elsewhere. Links come from the code-defined primary nav plus any
 * extra entries an editor adds to the `header` global.
 */
export async function Header() {
  const headerData = await getCachedGlobal('header', 1)()
  const items = [...PRIMARY_NAV, ...cmsLinks(headerData?.navItems)]

  return (
    <header data-theme="dark" className="relative z-20 bg-ink text-foreground">
      <div className="container">
        <div className="flex h-16 items-center justify-between gap-x-8 border-b border-border md:min-h-20">
          <Logo tone="paper" href="/" eager />
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
