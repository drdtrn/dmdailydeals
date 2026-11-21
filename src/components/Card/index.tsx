import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'
import { authorOfPost } from '@/lib/authors'
import { formatShortDate } from '@/lib/format'

export type CardPostData = Pick<Post, 'slug' | 'category' | 'meta' | 'title'> &
  Partial<Pick<Post, 'heroImage' | 'publishedAt' | 'populatedAuthor'>>

/**
 * Editorial card for a blog post (server component): category, title, summary, date and author.
 * The whole card is clickable through a stretched link, so it needs no client code or refs.
 */
export const Card: React.FC<{
  alignItems?: 'center'
  className?: string
  doc?: CardPostData
  relationTo?: 'posts'
  showCategories?: boolean
  title?: string
}> = (props) => {
  const { className, doc, showCategories, title: titleFromProps } = props

  const { slug, category, meta, title, heroImage, publishedAt } = doc || {}
  const { description, image: metaImage } = meta || {}
  const image = [metaImage, heroImage].find((i) => i && typeof i === 'object')
  const categoryTitle = typeof category === 'object' && category ? category.title : null
  const author = doc ? authorOfPost(doc) : null

  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, ' ') // replace non-breaking space with white space
  const href = `/blog/${slug}`

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-border-strong',
        className,
      )}
    >
      <div className="relative w-full">
        {!image && (
          <div className="flex aspect-[4/3] items-center justify-center bg-surface text-sm text-muted-foreground">
            No image
          </div>
        )}
        {image && typeof image !== 'string' && typeof image !== 'number' && (
          <Media resource={image} size="33vw" />
        )}
      </div>
      <div className="p-4">
        {showCategories && categoryTitle && (
          <div className="mb-3 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            {categoryTitle}
          </div>
        )}
        {titleToUse && (
          <h3 className="font-display text-xl leading-tight font-medium">
            <Link href={href} className="after:absolute after:inset-0 group-hover:underline">
              {titleToUse}
            </Link>
          </h3>
        )}
        {description && <p className="mt-2 text-soft-foreground">{sanitizedDescription}</p>}
        {(publishedAt || author) && (
          <p className="mt-3 text-xs text-subtle-foreground">
            {publishedAt ? (
              <time dateTime={publishedAt}>{formatShortDate(publishedAt)}</time>
            ) : null}
            {publishedAt && author ? ' · ' : null}
            {author ? <>By {author.displayName}</> : null}
          </p>
        )}
      </div>
    </article>
  )
}
