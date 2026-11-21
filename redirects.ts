import type { NextConfig } from 'next'

export const redirects: NextConfig['redirects'] = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header' as const,
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  // The template's /posts routes moved to /blog (Phase 5).
  const postsRedirects = [
    { source: '/posts', destination: '/blog', permanent: true },
    { source: '/posts/page/:pageNumber', destination: '/blog/page/:pageNumber', permanent: true },
    { source: '/posts/:slug', destination: '/blog/:slug', permanent: true },
  ]

  return [internetExplorerRedirect, ...postsRedirects]
}
