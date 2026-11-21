/** Public URL of a CMS document referenced from a link field or rich text. Posts live under /blog. */
export function docHref(relationTo: string, slug: string): string {
  return relationTo === 'posts' ? `/blog/${slug}` : `/${slug}`
}
