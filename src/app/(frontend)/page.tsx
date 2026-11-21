import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { GuideList } from '@/components/blog/GuideList'
import { AlwaysOnOffer } from '@/components/deals/AlwaysOnOffer'
import { CategoryNav } from '@/components/deals/CategoryNav'
import { Countdown } from '@/components/deals/Countdown'
import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { HeroBand } from '@/components/deals/HeroBand'
import { HeroDeal } from '@/components/deals/HeroDeal'
import { NewsletterCta } from '@/components/deals/NewsletterCta'
import { DealGrid } from '@/components/pages/DealGrid'
import { PageSection } from '@/components/pages/PageHeading'
import { JsonLd } from '@/components/seo/JsonLd'
import { listLatestPosts } from '@/lib/data/content'
import { getCurrentDrop } from '@/lib/data/drops'
import { getNextDropTarget, getOffer, getSiteSettings } from '@/lib/data/site'
import { formatDropAt } from '@/lib/format'
import { buildOrganization, buildWebSite } from '@/lib/seo/jsonld'
import { clipDescription, pageMetadata } from '@/lib/seo/meta'
import { parseSubscribedFlag, SUBSCRIBED_PARAM } from '@/lib/newsletter/copy'
import { siteOrigin } from '@/lib/seo/site'
import { safeHttpUrl } from '@/lib/safeUrl'
import { resolveImage } from '@/lib/media'

export async function generateMetadata(): Promise<Metadata> {
  const current = await getCurrentDrop()
  const hero = current?.hero
  return pageMetadata({
    title: 'DMDailyDeals: a fresh set of curated deals every day',
    absoluteTitle: true,
    description:
      clipDescription(
        hero
          ? `Today's drop: ${hero.title} plus ${current.picks.length} more curated deals across home, tech and travel. A new set every day at 9:00 AM ET.`
          : undefined,
      ) ??
      'A fresh set of curated deals across home, tech and travel, every day at 9:00 AM ET, with the price history checked.',
    path: '/',
    image: hero && resolveImage(hero.image, 'og') ? hero.image : null,
  })
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [current, nextDropAt, offer, settings, guides] = await Promise.all([
    getCurrentDrop(),
    getNextDropTarget(),
    getOffer(),
    getSiteSettings(),
    listLatestPosts(3),
  ])

  const subscribed = parseSubscribedFlag((await searchParams)[SUBSCRIBED_PARAM])
  const hero = current?.hero ?? null
  const origin = siteOrigin()
  const jsonLd = <JsonLd data={[buildWebSite(origin), buildOrganization(origin)]} />
  const showNewsletter = settings.newsletterEnabled !== false
  const telegramUrl = safeHttpUrl(settings.telegramChannelUrl) ?? undefined

  // Shown only when there are published guides.
  const fromTheBlog =
    guides.length > 0 ? (
      <PageSection
        title="From the blog"
        aside={
          <Link
            href="/blog"
            className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 hover:no-underline"
          >
            All guides
          </Link>
        }
      >
        <GuideList posts={guides} label="Latest guides" />
      </PageSection>
    ) : null

  const offerAndNewsletter = (
    <div className="mt-12 flex flex-wrap gap-6 md:mt-20">
      <AlwaysOnOffer offer={offer} className="flex-[1_1_420px]" />
      {showNewsletter ? (
        <NewsletterCta
          source="home"
          telegramUrl={telegramUrl}
          initialStatus={subscribed}
          className="flex-[1_1_420px]"
        />
      ) : null}
    </div>
  )

  if (!current || !hero) {
    return (
      <>
        {jsonLd}
        <section data-theme="dark" className="bg-ink pb-10 text-foreground md:pb-16">
          <div className="container py-8 md:py-14">
            <Countdown target={nextDropAt} />
            <h1 className="mt-8 font-display text-4xl leading-[1.1] font-medium text-balance md:mt-12 md:text-6xl">
              First drop lands {formatDropAt(nextDropAt)}
            </h1>
            <p className="mt-4 max-w-[52ch] text-soft-foreground md:text-lg">
              Every day we publish one hero deal and a handful of curated picks across home, tech
              and travel, each with the price checked. The first set is on its way.
            </p>
          </div>
        </section>
        <div className="container pt-10 md:pt-14">
          <CategoryNav
            leading={{ label: 'All', href: '/', active: true }}
            label="Browse by category"
          />
          {fromTheBlog}
          {offerAndNewsletter}
        </div>
      </>
    )
  }

  return (
    <>
      {jsonLd}
      <HeroBand dropDate={current.drop.date} countdown={<Countdown target={nextDropAt} />}>
        <HeroDeal
          deal={hero}
          lowestIn90Days={Boolean(current.lowest[String(hero.id)])}
          headingLevel="h1"
        />
      </HeroBand>

      <div className="container pt-10 md:pt-14">
        {current.drop.intro ? (
          <p className="mb-10 max-w-[62ch] text-soft-foreground md:mb-12 md:text-[17px]">
            {current.drop.intro}
          </p>
        ) : null}

        {current.picks.length > 0 ? (
          <PageSection
            title="Today’s picks"
            className="mt-0 md:mt-0"
            aside={
              <CategoryNav
                leading={{ label: 'All', href: '/', active: true }}
                label="Browse by category"
              />
            }
          >
            <DisclosureNote className="mb-6" />
            <DealGrid
              deals={current.picks}
              lowest={current.lowest}
              label="Today’s picks"
              eagerCount={2}
            />
            <p className="mt-8">
              <Link
                href="/drops"
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:no-underline"
              >
                Browse earlier drops
              </Link>
            </p>
          </PageSection>
        ) : null}

        {fromTheBlog}
        {offerAndNewsletter}
      </div>
    </>
  )
}
