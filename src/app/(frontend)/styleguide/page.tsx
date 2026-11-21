import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Logo } from '@/components/brand/Logo'
import { AlwaysOnOffer } from '@/components/deals/AlwaysOnOffer'
import { CategoryNav } from '@/components/deals/CategoryNav'
import { Countdown } from '@/components/deals/Countdown'
import { DealCard } from '@/components/deals/DealCard'
import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { HeroBand } from '@/components/deals/HeroBand'
import { HeroDeal } from '@/components/deals/HeroDeal'
import { NewsletterCta } from '@/components/deals/NewsletterCta'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEFAULT_DROP_SETTINGS, getNextDropAt } from '@/lib/drops/time'

import {
  expiredCard,
  heroDeal,
  heroExpired,
  heroWithImage,
  offer,
  picks,
  soldOutCard,
} from './fixtures'

export const metadata: Metadata = {
  title: 'Style guide',
  robots: { index: false, follow: false },
}

// The countdown target is "now"-dependent, so never prerender this page.
export const dynamic = 'force-dynamic'

const swatches: { name: string; token: string }[] = [
  { name: 'ink', token: 'bg-ink' },
  { name: 'paper', token: 'bg-paper border border-border' },
  { name: 'background', token: 'bg-background border border-border' },
  { name: 'surface', token: 'bg-surface' },
  { name: 'border', token: 'bg-border' },
  { name: 'border-strong', token: 'bg-border-strong' },
  { name: 'muted-foreground', token: 'bg-muted-foreground' },
  { name: 'subtle-foreground', token: 'bg-subtle-foreground' },
  { name: 'primary', token: 'bg-primary' },
  { name: 'deal (accent)', token: 'bg-deal' },
]

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="mt-14 first:mt-0">
      <h2 id={id} className="mb-6 border-b border-border pb-3 font-display text-3xl font-medium">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Cards({ dark = false }: { dark?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-3.5 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-9 lg:grid-cols-4">
      {picks.map(({ deal, lowest }) => (
        <DealCard key={`${dark}-${deal.id}`} deal={deal} lowestIn90Days={lowest} />
      ))}
      <DealCard deal={expiredCard} />
      <DealCard deal={soldOutCard} />
    </div>
  )
}

/** Renders every design-system component with fixtures. Dev only; 404s in production. */
export default function StyleguidePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const nextDrop = getNextDropAt(new Date(), DEFAULT_DROP_SETTINGS).toISOString()
  const dropDate = new Date().toISOString()

  return (
    <>
      <div className="container py-10 md:py-14">
        <Breadcrumbs
          items={[{ label: 'DMDailyDeals', href: '/' }, { label: 'Style guide' }]}
          className="mb-6"
        />
        <h1 className="font-display text-4xl leading-tight font-medium md:text-5xl">Style guide</h1>
        <p className="mt-3 max-w-prose text-soft-foreground">
          Every component with fixture data, in its normal and expired states, then again inside a
          dark scope. Use the sun/moon button in the footer to flip the whole page between light and
          dark. The hero band and header are dark in both. Not indexed; returns 404 in production.
        </p>

        <div className="mt-12">
          <Section id="sg-tokens" title="Tokens">
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {swatches.map((s) => (
                <li key={s.name} className="text-[13px]">
                  <div className={`h-16 rounded-md ${s.token}`} />
                  <p className="mt-2 text-muted-foreground">{s.name}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                  Display: Bodoni Moda
                </p>
                <p className="mt-2 font-display text-5xl leading-[1.08] font-medium">
                  Noise-cancelling headphones
                </p>
                <p className="mt-2 font-display text-2xl italic">Saturday, November 21</p>
                <p className="mt-3 font-display text-4xl font-medium [font-variant-numeric:lining-nums]">
                  $229 <s className="text-lg text-subtle-foreground">$369</s>
                </p>
              </div>
              <div>
                <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                  UI: DM Sans
                </p>
                <p className="mt-2 text-base font-semibold">Semibold UI label, 16px</p>
                <p className="mt-1 text-soft-foreground">
                  Body copy at the default size sits in the soft foreground token.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Muted helper text, 14px</p>
                <p className="mt-1 text-xs text-subtle-foreground">Subtle meta text, 12px</p>
              </div>
            </div>
          </Section>

          <Section id="sg-brand" title="Brand">
            <div className="flex flex-wrap items-center gap-10">
              <div className="rounded-md bg-ink p-6" data-theme="dark">
                <Logo tone="paper" />
              </div>
              <div className="rounded-md border border-border p-6">
                <Logo tone="ink" />
              </div>
              <div className="rounded-md border border-border p-6">
                <Logo tone="auto" variant="monogram" />
              </div>
            </div>
          </Section>

          <Section id="sg-controls" title="Controls and navigation">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Default</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="mt-6 grid max-w-md gap-2">
              <Label htmlFor="sg-input">Email address</Label>
              <Input id="sg-input" type="email" placeholder="you@example.com" />
            </div>
            <div className="mt-8 space-y-6">
              <CategoryNav
                label="Categories (pills)"
                leading={{ label: 'All', href: '/', active: true }}
              />
              <CategoryNav label="Categories (active)" activeSlug="tech" />
              <div className="rounded-md bg-ink p-4 text-foreground" data-theme="dark">
                <CategoryNav label="Categories (links)" variant="links" activeSlug="travel" />
              </div>
              <Breadcrumbs
                label="Breadcrumb (three levels)"
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Tech', href: '/deals/tech' },
                  { label: 'Noise-cancelling wireless headphones' },
                ]}
              />
              <DisclosureNote />
            </div>
          </Section>
        </div>
      </div>

      <HeroBand dropDate={dropDate} issueNumber={42} countdown={<Countdown target={nextDrop} />}>
        <HeroDeal deal={heroWithImage} lowestIn90Days headingLevel="h2" />
      </HeroBand>

      <div className="container pt-10 md:pt-14">
        <Section id="sg-hero-states" title="Hero deal: no photo, and expired">
          <div data-theme="dark" className="rounded-md bg-ink p-5 text-foreground md:p-10">
            <HeroDeal deal={heroDeal} lowestIn90Days />
          </div>
          <div data-theme="dark" className="mt-8 rounded-md bg-ink p-5 text-foreground md:p-10">
            <HeroDeal deal={heroExpired} />
          </div>
        </Section>

        <Section id="sg-cards" title="Deal cards (last two: expired and sold out)">
          <Cards />
        </Section>

        <Section id="sg-slots" title="eSIM slot and newsletter">
          <div className="flex flex-wrap gap-6">
            <AlwaysOnOffer offer={offer} className="flex-[1_1_420px]" />
            <NewsletterCta
              source="styleguide"
              id="sg-newsletter"
              telegramUrl="https://t.me/example"
              className="flex-[1_1_420px]"
            />
          </div>
        </Section>

        <Section id="sg-dark" title="Dark scope">
          <div data-theme="dark" className="rounded-md bg-background p-5 text-foreground md:p-8">
            <Cards dark />
            <div className="mt-10 flex flex-wrap gap-6">
              <AlwaysOnOffer offer={offer} headingLevel="h3" className="flex-[1_1_420px]" />
              <NewsletterCta
                source="styleguide-dark"
                id="sg-newsletter-dark"
                headingLevel="h3"
                className="flex-[1_1_420px] border border-border"
              />
            </div>
          </div>
        </Section>
      </div>
    </>
  )
}
