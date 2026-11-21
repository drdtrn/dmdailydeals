import Link from 'next/link'
import React from 'react'

import type { PostCard } from '@/lib/data/content'

import { authorOfPost } from '@/lib/authors'
import { formatShortDate } from '@/lib/format'
import { cn } from '@/utilities/ui'

/**
 * A plain list of guides (category eyebrow, title, date and author), as in the home mockup's
 * "From the blog". Used on the home page and on category hubs ("Latest guides").
 */
export function GuideList({
  posts,
  label,
  showCategory = true,
  headingLevel: Heading = 'h3',
  className,
}: {
  posts: PostCard[]
  label: string
  showCategory?: boolean
  headingLevel?: 'h2' | 'h3' | 'h4'
  className?: string
}) {
  if (posts.length === 0) return null
  return (
    <ul aria-label={label} className={cn('border-t border-border', className)}>
      {posts.map((post) => {
        const category =
          typeof post.category === 'object' && post.category ? post.category.title : null
        const author = authorOfPost(post)
        const meta = [
          showCategory ? category : null,
          post.publishedAt ? formatShortDate(post.publishedAt) : null,
          author ? `By ${author.displayName}` : null,
        ].filter(Boolean)
        return (
          <li key={post.id} className="border-b border-border">
            <Link
              href={`/blog/${post.slug}`}
              className="block py-4 text-foreground no-underline hover:underline"
            >
              {meta.length > 0 ? (
                <span className="block text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  {meta.join(' · ')}
                </span>
              ) : null}
              <Heading className="mt-1 font-display text-xl leading-tight font-medium">
                {post.title}
              </Heading>
              {post.meta?.description ? (
                <span className="mt-1 block max-w-[62ch] text-soft-foreground">
                  {post.meta.description}
                </span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
