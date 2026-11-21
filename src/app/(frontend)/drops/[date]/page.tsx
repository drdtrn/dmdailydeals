import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { HeroDeal } from '@/components/deals/HeroDeal'
import { DealGrid } from '@/components/pages/DealGrid'
import { JsonLd } from '@/components/seo/JsonLd'
import { PageHeading, PageSection } from '@/components/pages/PageHeading'
import { getDropByDate, getDropNeighbours } from '@/lib/data/drops'
import { parseDropDate } from '@/lib/drops/time'
import { formatFullDate, formatShortDate } from '@/lib/format'
import { resolveImage } from '@/lib/media'
import { buildArticle, buildBreadcrumbList, buildItemList } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/meta'
import { ROOT_CRUMB, siteOrigin } from '@/lib/seo/site'
import { dealHref } from '@/components/deals/dealView'

type Props = { params: Promise<{ date: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const date = parseDropDate((await params).date)
  const found = date ? await getDropByDate(date) : null
  if (!date || !found) return {}
  const label = formatFullDate(found.drop.date)
  const hero = found.hero
  return pageMetadata({
    title: `Deals of ${label}`,
    description:
      found.drop.intro ||
      (hero
        ? `The ${label} drop: ${hero.title} plus ${found.picks.length} more curated deals.`
        : `The ${label} drop of curated deals.`),
    path: `/drops/${date}`,
    image: hero && resolveImage(hero.image, 'og') ? hero.image : null,
  })
}

export default async function DropPage({ params }: Props) {
  const date = parseDropDate((await params).date)
  if (!date) notFound()
  const found = await getDropByDate(date)
  if (!found) notFound()

  const neighbours = await getDropNeighbours(date)
  const { drop, hero, picks, lowest } = found
  const label = formatFullDate(drop.date)
  const isLive = drop.status === 'live'
  const origin = siteOrigin()
  const path = `/drops/${date}`
  const crumbs = [ROOT_CRUMB, { label: 'Drops', href: '/drops' }, { label: date }]
  const deals = [...(hero ? [hero] : []), ...picks]
  const description =
    drop.intro ||
    (hero
      ? `The ${label} drop: ${hero.title} plus ${picks.length} more curated deals.`
      : `The ${label} drop of curated deals.`)

  return (
    <div className="container pb-8">
      <JsonLd
        data={[
          buildArticle(origin, {
            headline: `Deals of ${label}`,
            description,
            path,
            datePublished: drop.publishAt || drop.date,
            dateModified: drop.updatedAt,
            image: hero?.image,
          }),
          buildBreadcrumbList(origin, crumbs, path),
          buildItemList(
            origin,
            `Deals of ${label}`,
            deals.map((deal) => dealHref(deal)),
          ),
        ]}
      />
      <PageHeading
        crumbs={crumbs}
        eyebrow={isLive ? 'Today’s drop' : 'Past drop'}
        title={<>Deals of {label}</>}
        lead={drop.intro}
      />

      {hero ? (
        <div data-theme="dark" className="rounded-md bg-ink p-5 text-foreground md:p-10">
          <HeroDeal
            deal={hero}
            lowestIn90Days={Boolean(lowest[String(hero.id)])}
            headingLevel="h2"
          />
        </div>
      ) : null}

      {picks.length > 0 ? (
        <PageSection title="The picks">
          <DisclosureNote className="mb-6" />
          <DealGrid deals={picks} lowest={lowest} label={`Picks of ${label}`} eagerCount={2} />
        </PageSection>
      ) : null}

      <nav
        aria-label="Other drops"
        className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6"
      >
        {neighbours.previous ? (
          <Link
            href={`/drops/${neighbours.previous}`}
            rel="prev"
            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:no-underline"
          >
            ← Previous drop: {formatShortDate(`${neighbours.previous}T12:00:00Z`)}
          </Link>
        ) : (
          <span />
        )}
        <Link
          href="/drops"
          className="inline-flex min-h-11 items-center underline underline-offset-4 hover:no-underline"
        >
          All drops
        </Link>
        {neighbours.next ? (
          <Link
            href={`/drops/${neighbours.next}`}
            rel="next"
            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:no-underline"
          >
            Next drop: {formatShortDate(`${neighbours.next}T12:00:00Z`)} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  )
}
