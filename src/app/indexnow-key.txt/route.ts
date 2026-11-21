import { indexNowKeyFile } from '@/lib/seo/indexnow'

/** Reads the environment per request: the key is not known at build time. */
export const dynamic = 'force-dynamic'

export async function GET() {
  const body = indexNowKeyFile(process.env.INDEXNOW_KEY)
  if (body === null) return new Response('Not found', { status: 404 })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
