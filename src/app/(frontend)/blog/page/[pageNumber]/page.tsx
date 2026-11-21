import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import React from 'react'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageHeading } from '@/components/pages/PageHeading'
import { Pager } from '@/components/pages/Pager'
import { blogPageHref } from '@/lib/blogHref'
import { listPosts } from '@/lib/data/content'
import { parsePageParam } from '@/lib/pagination'
import { pageMetadata } from '@/lib/seo/meta'

type Args = { params: Promise<{ pageNumber: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const parsed = parsePageParam((await params).pageNumber)
  const page = parsed.ok ? parsed.page : 1
  return pageMetadata({
    title: `Blog, page ${page}`,
    description: 'Practical guides on eSIMs, travel, home and tech.',
    path: blogPageHref(page),
  })
}

export default async function BlogPage({ params }: Args) {
  const parsed = parsePageParam((await params).pageNumber)
  if (!parsed.ok) notFound()
  // Page 1 lives at /blog; don't serve a duplicate.
  if (parsed.page === 1) permanentRedirect('/blog')

  const posts = await listPosts(parsed.page)
  if (parsed.page > posts.totalPages || posts.docs.length === 0) notFound()

  return (
    <div className="pb-16">
      <div className="container">
        <PageHeading
          crumbs={[
            { label: 'Home', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: `Page ${parsed.page}` },
          ]}
          title={`Blog, page ${parsed.page}`}
        />
      </div>
      <CollectionArchive posts={posts.docs} />
      <div className="container">
        <Pager
          page={parsed.page}
          totalPages={posts.totalPages}
          hrefFor={blogPageHref}
          label="Blog pages"
        />
      </div>
    </div>
  )
}
