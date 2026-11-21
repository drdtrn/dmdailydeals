import Link from 'next/link'
import React from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'
import { Breadcrumbs, type Crumb } from '@/components/layout/Breadcrumbs'
import { authorOfPost } from '@/lib/authors'
import { categoryHref } from '@/lib/categories'
import { formatFullDate } from '@/lib/format'

/** More than a day between publishing and the last edit: show "Updated". */
const UPDATED_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * Post header: breadcrumbs, category, the page's h1, byline with dates, then the hero image.
 * Dates are absolute (formatted from the stored instant) so a cached page never says "2 days ago".
 */
export const PostHero: React.FC<{
  post: Post
  crumbs: Crumb[]
}> = ({ post, crumbs }) => {
  const { category, heroImage, publishedAt, updatedAt, title } = post
  const author = authorOfPost(post)
  const categoryDoc = typeof category === 'object' && category ? category : null
  const showUpdated =
    publishedAt &&
    updatedAt &&
    new Date(updatedAt).getTime() - new Date(publishedAt).getTime() > UPDATED_AFTER_MS

  return (
    <header className="container pt-8 md:pt-12">
      <div className="mx-auto max-w-[48rem]">
        <Breadcrumbs items={crumbs} className="mb-5" />
        {categoryDoc?.slug ? (
          <p className="mb-4 text-xs tracking-[0.16em] text-muted-foreground uppercase">
            <Link href={categoryHref(categoryDoc.slug)} className="hover:underline">
              {categoryDoc.title}
            </Link>
          </p>
        ) : null}
        <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {author ? <span>By {author.displayName}</span> : null}
          {publishedAt ? (
            <span>
              Published <time dateTime={publishedAt}>{formatFullDate(publishedAt)}</time>
            </span>
          ) : null}
          {showUpdated ? (
            <span>
              Updated <time dateTime={updatedAt}>{formatFullDate(updatedAt)}</time>
            </span>
          ) : null}
        </p>
      </div>
      {heroImage && typeof heroImage !== 'number' ? (
        <div className="relative mx-auto mt-8 aspect-[16/9] max-w-[60rem] overflow-hidden rounded-md">
          <Media fill preload htmlElement={null} imgClassName="object-cover" resource={heroImage} />
        </div>
      ) : null}
    </header>
  )
}
