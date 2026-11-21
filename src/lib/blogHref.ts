/** URL of page `n` of the blog index. Page 1 is the clean /blog URL. */
export const blogPageHref = (page: number) => (page <= 1 ? '/blog' : `/blog/page/${page}`)
