import type { Metadata } from 'next'
import React from 'react'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageHeading } from '@/components/pages/PageHeading'
import { Pager } from '@/components/pages/Pager'
import { blogPageHref } from '@/lib/blogHref'
import { listPosts } from '@/lib/data/content'
import { pageMetadata } from '@/lib/seo/meta'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Blog: guides for home, tech and travel',
    description:
      'Practical guides on eSIMs, travel, home and tech, written to help you decide what is worth buying.',
    path: '/blog',
  })
}

export default async function BlogIndexPage() {
  const posts = await listPosts(1)

  return (
    <div className="pb-16">
      <div className="container">
        <PageHeading
          crumbs={[{ label: 'Home', href: '/' }, { label: 'Blog' }]}
          title="Blog"
          lead="Practical guides on eSIMs, travel, home and tech, to help you decide what is worth buying."
        />
      </div>
      {posts.docs.length > 0 ? (
        <CollectionArchive posts={posts.docs} />
      ) : (
        <div className="container">
          <p className="text-soft-foreground">No guides have been published yet.</p>
        </div>
      )}
      <div className="container">
        <Pager page={1} totalPages={posts.totalPages} hrefFor={blogPageHref} label="Blog pages" />
      </div>
    </div>
  )
}
