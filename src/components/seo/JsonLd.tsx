import React from 'react'

import { serializeJsonLd } from '@/lib/seo/jsonld'

/** One `<script type="application/ld+json">` per block. Pass `null` entries freely; they are skipped. */
export function JsonLd({
  data,
}: {
  data: (object | null | undefined) | (object | null | undefined)[]
}) {
  const blocks = (Array.isArray(data) ? data : [data]).filter((b): b is object => Boolean(b))
  return (
    <>
      {blocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }}
        />
      ))}
    </>
  )
}
