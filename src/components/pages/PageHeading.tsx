import React from 'react'

import { Breadcrumbs, type Crumb } from '@/components/layout/Breadcrumbs'
import { cn } from '@/utilities/ui'

type Props = {
  crumbs?: Crumb[]
  eyebrow?: string
  title: React.ReactNode
  /** A short paragraph under the title. */
  lead?: React.ReactNode
  className?: string
}

/** Breadcrumbs, the page's single h1 and an optional lead paragraph. */
export function PageHeading({ crumbs, eyebrow, title, lead, className }: Props) {
  return (
    <header className={cn('pt-8 pb-8 md:pt-12 md:pb-10', className)}>
      {crumbs ? <Breadcrumbs items={crumbs} className="mb-5" /> : null}
      {eyebrow ? (
        <p className="mb-2 text-xs tracking-[0.16em] text-muted-foreground uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance md:text-5xl">
        {title}
      </h1>
      {lead ? (
        <div className="mt-4 max-w-[62ch] text-soft-foreground md:text-[17px]">{lead}</div>
      ) : null}
    </header>
  )
}

/** A titled block of a page (h2) with an optional right-hand slot for links or filters. */
export function PageSection({
  title,
  aside,
  children,
  className,
}: {
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-10 md:mt-14', className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-7">
        <h2 className="font-display text-3xl leading-tight font-medium md:text-4xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
