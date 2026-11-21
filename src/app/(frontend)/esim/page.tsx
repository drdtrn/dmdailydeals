import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import React from 'react'

import { DealImage } from '@/components/deals/DealImage'
import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { PageHeading } from '@/components/pages/PageHeading'
import RichText from '@/components/RichText'
import { buttonVariants } from '@/components/ui/button'
import { getOffer } from '@/lib/data/site'
import { clipDescription, pageMetadata } from '@/lib/seo/meta'
import { safeHttpUrl } from '@/lib/safeUrl'

export async function generateMetadata(): Promise<Metadata> {
  const offer = await getOffer()
  return pageMetadata({
    title: offer.meta?.title || offer.title,
    description:
      offer.meta?.description ||
      clipDescription(
        `${offer.title} from ${offer.partner}${offer.discountPercent ? `: ${offer.discountPercent}% off` : ''}${offer.code ? ` with code ${offer.code}` : ''}.`,
      ),
    path: '/esim',
    image: offer.meta?.image ?? offer.image,
  })
}

export default async function EsimPage() {
  const offer = await getOffer()
  const href = safeHttpUrl(offer.url)

  return (
    <div className="container pb-8">
      <PageHeading
        crumbs={[{ label: 'Home', href: '/' }, { label: 'eSIM' }]}
        eyebrow="The deal that never expires"
        title={offer.title}
      />

      <div className="flex flex-wrap items-start gap-x-14 gap-y-8">
        <DealImage
          image={offer.image}
          alt={offer.title}
          categorySlug="travel"
          size="hero"
          sizes="(min-width: 1200px) 560px, (min-width: 768px) 50vw, 100vw"
          preload
          className="aspect-[4/3] min-w-0 flex-[1_1_380px]"
        />
        <div className="min-w-0 flex-[1_1_380px]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[15px]">
            <dt className="text-muted-foreground">Partner</dt>
            <dd className="font-semibold">{offer.partner}</dd>
            {offer.discountPercent ? (
              <>
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="font-semibold">{offer.discountPercent}% off</dd>
              </>
            ) : null}
            {offer.code ? (
              <>
                <dt className="text-muted-foreground">Code</dt>
                <dd>
                  <code className="rounded-xs border border-dashed border-border-strong px-2.5 py-1 font-mono font-bold tracking-[0.06em]">
                    {offer.code}
                  </code>
                </dd>
              </>
            ) : null}
          </dl>

          {href ? (
            <div className="mt-6 flex flex-col gap-2.5 md:mt-8">
              <a
                href={href}
                rel="sponsored nofollow noopener"
                className={buttonVariants({
                  size: 'lg',
                  className: 'w-full md:w-auto md:self-start',
                })}
              >
                Get the offer at {offer.partner}
                <ArrowRight aria-hidden="true" strokeWidth={1.75} />
              </a>
              <DisclosureNote />
            </div>
          ) : null}
        </div>
      </div>

      {offer.landingContent ? (
        <section aria-label="About this offer" className="mt-12 md:mt-16">
          <RichText data={offer.landingContent} enableGutter={false} className="max-w-[62ch]" />
        </section>
      ) : null}
    </div>
  )
}
