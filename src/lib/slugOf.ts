import type { CollectionSlug, PayloadRequest } from 'payload'

/** The slug of a related document, or undefined if it can't be read. Used to build cache tags. */
export async function slugOf(
  req: PayloadRequest,
  collection: CollectionSlug,
  id: number | string | undefined,
): Promise<string | undefined> {
  if (id === undefined) return undefined
  try {
    const doc = (await req.payload.findByID({
      collection,
      id,
      depth: 0,
      select: { slug: true },
      overrideAccess: true,
      req,
    })) as { slug?: string }
    return doc.slug
  } catch {
    return undefined
  }
}
