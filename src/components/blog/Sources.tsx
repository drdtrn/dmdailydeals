import React from 'react'

import { safeHttpUrl } from '@/lib/safeUrl'

type Source = { title: string; url: string; id?: string | null }

/** The "Sources" list under a post: the pages it is based on. */
export function Sources({ sources }: { sources: Source[] }) {
  const items = sources.flatMap((s) => {
    const href = safeHttpUrl(s.url)
    return href
      ? [{ title: s.title, href, host: new URL(href).hostname.replace(/^www\./, '') }]
      : []
  })
  if (items.length === 0) return null
  return (
    <section aria-labelledby="post-sources" className="mt-12">
      <h2 id="post-sources" className="font-display text-2xl font-medium">
        Sources
      </h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-soft-foreground">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              {item.title}
            </a>{' '}
            <span className="text-sm text-subtle-foreground">({item.host})</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
