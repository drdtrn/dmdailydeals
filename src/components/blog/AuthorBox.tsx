import React from 'react'

import type { PublicAuthor } from '@/lib/authors'

import { Media } from '@/components/Media'
import { resolveImage } from '@/lib/media'
import { safeHttpUrl } from '@/lib/safeUrl'

/** The author's short bio under the post: avatar, name, bio and profile links. Public fields only. */
export function AuthorBox({ author }: { author: PublicAuthor }) {
  const links = author.sameAs.map(safeHttpUrl).filter((u): u is string => Boolean(u))
  const avatar = author.avatar && resolveImage(author.avatar, 'card') ? author.avatar : null
  return (
    <aside
      aria-label="About the author"
      className="flex gap-4 rounded-md border border-border bg-card p-4 md:p-5"
    >
      {avatar ? (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full">
          <Media
            fill
            htmlElement={null}
            imgClassName="object-cover"
            resource={avatar}
            size="64px"
          />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="font-display text-lg font-medium">{author.displayName}</p>
        {author.bio ? <p className="mt-1 text-soft-foreground">{author.bio}</p> : null}
        {links.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 text-sm">
            {links.map((href) => (
              <li key={href}>
                <a
                  href={href}
                  rel="me noopener"
                  className="inline-flex min-h-11 items-center underline underline-offset-4 hover:no-underline"
                >
                  {new URL(href).hostname.replace(/^www\./, '')}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  )
}
