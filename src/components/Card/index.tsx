import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React, { Fragment } from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'

export type CardPostData = Pick<Post, 'slug' | 'categories' | 'meta' | 'title'>

/**
 * Editorial card for a blog post (server component). The whole card is clickable through a
 * stretched link, so it needs no client code or refs.
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

  const { slug, categories, meta, title } = doc || {}
  const { description, image: metaImage } = meta || {}

  const hasCategories = categories && Array.isArray(categories) && categories.length > 0
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
        {!metaImage && (
          <div className="flex aspect-[4/3] items-center justify-center bg-surface text-sm text-muted-foreground">
            No image
          </div>
        )}
        {metaImage && typeof metaImage !== 'string' && <Media resource={metaImage} size="33vw" />}
      </div>
      <div className="p-4">
        {showCategories && hasCategories && (
          <div className="mb-3 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            {categories?.map((category, index) => {
              if (typeof category === 'object') {
                const { title: titleFromCategory } = category

                const categoryTitle = titleFromCategory || 'Untitled category'

                const isLast = index === categories.length - 1

                return (
                  <Fragment key={index}>
                    {categoryTitle}
                    {!isLast && <Fragment>, &nbsp;</Fragment>}
                  </Fragment>
                )
              }

              return null
            })}
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
      </div>
    </article>
  )
}
