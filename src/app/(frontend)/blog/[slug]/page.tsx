import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { RelatedPosts } from '@/blocks/RelatedPosts/Component'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import RichText from '@/components/RichText'
import { PostHero } from '@/heros/PostHero'
import { getPostBySlug } from '@/lib/data/content'
import { generateMeta } from '@/utilities/generateMeta'

type Args = { params: Promise<{ slug?: string }> }

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

export default async function Post({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const slug = decodeSlug((await paramsPromise).slug)
  const url = '/blog/' + slug
  const post = await loadPost(slug)

  if (!post) return <PayloadRedirects url={url} />

  return (
    <article className="pb-16">
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <PostHero post={post} />

      <div className="flex flex-col items-center gap-4 pt-8">
        <div className="container">
          <RichText className="mx-auto max-w-[48rem]" data={post.content} enableGutter={false} />
          {post.relatedPosts && post.relatedPosts.length > 0 && (
            <RelatedPosts
              className="col-span-3 col-start-1 mt-12 max-w-[52rem] grid-rows-[2fr] lg:grid lg:grid-cols-subgrid"
              docs={post.relatedPosts.filter((post) => typeof post === 'object')}
            />
          )}
        </div>
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const slug = decodeSlug((await paramsPromise).slug)
  const post = await loadPost(slug)
  if (!post) return {}
  return { ...(await generateMeta({ doc: post, path: `/blog/${slug}` })) }
}
