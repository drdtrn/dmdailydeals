import Link from 'next/link'
import React from 'react'

/**
 * List cell for a brief's `post`: a link straight to the draft's edit page (Payload's default
 * relationship cell shows plain text).
 */
export function PostLinkCell({ cellData }: { cellData?: unknown }) {
  const id =
    typeof cellData === 'object' && cellData !== null
      ? (cellData as { id?: number | string }).id
      : (cellData as number | string | undefined)
  if (id === undefined || id === null || id === '') return <span>-</span>
  return (
    <Link href={`/admin/collections/posts/${id}`} prefetch={false}>
      Open draft
    </Link>
  )
}
