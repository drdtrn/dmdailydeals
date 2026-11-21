import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

// Self-hosted (VPS): the public URL comes from the environment, not Vercel variables.
const NEXT_PUBLIC_SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

const nextConfig: NextConfig = {
  // Standalone server output for the Docker image (node server.js).
  output: 'standalone',
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  images: {
    // Local images only: Payload uploads and the brand marks in /public/brand.
    localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/brand/**' }],
    qualities: [75],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        }
      }),
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
  turbopack: {
    root: path.resolve(dirname),
  },
}

const payloadConfig = withPayload(nextConfig, { devBundleServerPackages: false })
const payloadHeaders = payloadConfig.headers

/**
 * withPayload adds `Critical-CH: Sec-CH-Prefers-Color-Scheme` to every route so the admin can follow
 * the OS theme. Critical-CH makes a browser repeat its first request to a site, which costs the
 * public pages about 600 ms (Lighthouse reports it as a redirect). The public site does not use the
 * hint, so keep Payload's client-hint headers on /admin only.
 */
export default {
  ...payloadConfig,
  headers: async () => {
    const rules = (await payloadHeaders?.()) ?? []
    return rules.flatMap((rule) => {
      if (rule.source !== '/:path*') return [rule]
      const hints = ['accept-ch', 'critical-ch', 'vary']
      const others = rule.headers.filter((h) => !hints.includes(h.key.toLowerCase()))
      return [
        { ...rule, source: '/admin/:path*' },
        ...(others.length ? [{ ...rule, headers: others }] : []),
      ]
    })
  },
} satisfies NextConfig
