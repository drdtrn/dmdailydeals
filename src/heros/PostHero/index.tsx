import { formatDateTime } from 'src/utilities/formatDateTime'
import React from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'
import { formatAuthors } from '@/utilities/formatAuthors'

/** Post header: categories, the page's h1, byline and date, then the hero image if there is one. */
export const PostHero: React.FC<{
  post: Post
}> = ({ post }) => {
  const { categories, heroImage, populatedAuthors, publishedAt, title } = post

  const hasAuthors =
    populatedAuthors && populatedAuthors.length > 0 && formatAuthors(populatedAuthors) !== ''
  const categoryTitles = (categories ?? [])
    .map((category) => (typeof category === 'object' && category !== null ? category.title : null))
    .filter(Boolean)

  return (
    <header className="container pt-10 md:pt-14">
      <div className="mx-auto max-w-[48rem]">
        {categoryTitles.length > 0 ? (
          <p className="mb-4 text-xs tracking-[0.16em] text-muted-foreground uppercase">
            {categoryTitles.join(', ')}
          </p>
        ) : null}
        <h1 className="font-display text-4xl leading-[1.1] font-medium text-balance md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
          {hasAuthors ? <span>By {formatAuthors(populatedAuthors)}</span> : null}
          {publishedAt ? <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time> : null}
        </p>
      </div>
      {heroImage && typeof heroImage !== 'string' ? (
        <div className="relative mx-auto mt-8 aspect-[16/9] max-w-[60rem] overflow-hidden rounded-md">
          <Media fill preload imgClassName="object-cover" resource={heroImage} />
        </div>
      ) : null}
    </header>
  )
}
