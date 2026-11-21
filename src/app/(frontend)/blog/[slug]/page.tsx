import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { RelatedPosts } from '@/blocks/RelatedPosts/Component'
import { AuthorBox } from '@/components/blog/AuthorBox'
import { Sources } from '@/components/blog/Sources'
import { DisclosureNote } from '@/components/deals/DisclosureNote'
import { NewsletterCta } from '@/components/deals/NewsletterCta'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { DealGrid } from '@/components/pages/DealGrid'
import { PageSection } from '@/components/pages/PageHeading'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import RichText from '@/components/RichText'
import { JsonLd } from '@/components/seo/JsonLd'
import { PostHero } from '@/heros/PostHero'
import { authorOfPost } from '@/lib/authors'
import { dealsByIds, getLowestFlags } from '@/lib/data/deals'
import { getPostBySlug, getPostRelatedDeals } from '@/lib/data/content'
import { getSiteSettings } from '@/lib/data/site'
import { relId } from '@/lib/relId'
import { parseSubscribedFlag, SUBSCRIBED_PARAM } from '@/lib/newsletter/copy'
import { buildBlogPosting, buildBreadcrumbList } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/meta'
import { ROOT_CRUMB, siteOrigin } from '@/lib/seo/site'
import { safeHttpUrl } from '@/lib/safeUrl'
import type { Deal, Post } from '@/payload-types'

type Args = {
  params: Promise<{ slug?: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function decodeSlug(slug = ''): string {
  try {
    return decodeURIComponent(slug)
  } catch {
    return ''
  }
}

/** Draft mode (admin preview) reads the draft straight from Payload, uncached. */
const queryDraftPost = cache(async (slug: string) => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'posts',
    draft: true,
    limit: 1,
    depth: 1,
    overrideAccess: true,
    pagination: false,
    where: { slug: { equals: slug } },
  })
  return result.docs?.[0] || null
})

async function loadPost(slug: string) {
  const { isEnabled: draft } = await draftMode()
  return draft ? queryDraftPost(slug) : getPostBySlug(slug)
}

/** Only live deals are shown, whichever way the post was loaded. */
async function loadRelatedDeals(post: Post, draft: boolean): Promise<Deal[]> {
  const ids = (post.relatedDeals ?? [])
    .map(relId)
    .filter((id): id is number | string => id !== undefined)
  if (ids.length === 0) return []
  if (!draft) return getPostRelatedDeals(post.slug ?? '', ids)
  const payload = await getPayload({ config: configPromise })
  return (await dealsByIds(payload, ids)).filter((d) => d.status === 'live')
}

export default async function PostPage({ params: paramsPromise, searchParams }: Args) {
  const { isEnabled: draft } = await draftMode()
  const slug = decodeSlug((await paramsPromise).slug)
  const path = '/blog/' + slug
  const post = await loadPost(slug)

  if (!post) return <PayloadRedirects url={path} />

  const [deals, settings] = await Promise.all([loadRelatedDeals(post, draft), getSiteSettings()])
  const lowest = await getLowestFlags(deals)
  const subscribed = parseSubscribedFlag((await searchParams)[SUBSCRIBED_PARAM])
  const author = authorOfPost(post)
  const origin = siteOrigin()
  const category = typeof post.category === 'object' && post.category ? post.category : null
  const crumbs = [ROOT_CRUMB, { label: 'Blog', href: '/blog' }, { label: post.title }]
  const sources = (post.sources ?? []).filter((s) => safeHttpUrl(s.url))
  const relatedPosts = (post.relatedPosts ?? []).filter((p) => typeof p === 'object')

  return (
    <article className="pb-16">
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={path} />

      {draft && <LivePreviewListener />}

      <JsonLd
        data={[
          buildBlogPosting(origin, {
            headline: post.title,
            description: post.meta?.description,
            path,
            datePublished: post.publishedAt ?? post.createdAt,
            dateModified: post.updatedAt,
            image: post.meta?.image ?? post.heroImage,
            section: category?.title,
            author: author ? { name: author.displayName, sameAs: author.sameAs } : null,
          }),
          buildBreadcrumbList(origin, crumbs, path),
        ]}
      />

      <PostHero post={post} crumbs={crumbs} />

      <div className="container pt-8">
        <div className="mx-auto max-w-[48rem]">
          <RichText data={post.content} enableGutter={false} />
          <Sources sources={sources} />
          {author ? (
            <div className="mt-12">
              <AuthorBox author={author} />
            </div>
          ) : null}
        </div>

        {deals.length > 0 ? (
          <PageSection title="Related deals">
            <DisclosureNote className="mb-6" />
            <DealGrid deals={deals} lowest={lowest} label="Related deals" headingLevel="h3" />
          </PageSection>
        ) : null}

        {relatedPosts.length > 0 ? (
          <RelatedPosts
            className="col-span-3 col-start-1 mt-12 max-w-[52rem] grid-rows-[2fr] lg:grid lg:grid-cols-subgrid"
            docs={relatedPosts}
          />
        ) : null}

        {settings.newsletterEnabled !== false ? (
          <div className="mt-12">
            <NewsletterCta
              source="blog"
              telegramUrl={safeHttpUrl(settings.telegramChannelUrl) ?? undefined}
              initialStatus={subscribed}
            />
          </div>
        ) : null}
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const slug = decodeSlug((await paramsPromise).slug)
  const post = await loadPost(slug)
  if (!post) return {}
  return pageMetadata({
    title: (post.meta?.title || post.title).replace(/\s*[|·]\s*DMDailyDeals$/, ''),
    description: post.meta?.description,
    image: post.meta?.image ?? post.heroImage,
    path: `/blog/${slug}`,
    type: 'article',
  })
}
