import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description:
    'A fresh set of curated deals across home, tech and travel, every day at 9:00 AM ET.',
  images: [
    {
      url: `${getServerSideURL()}/brand/og-default.png`,
      width: 1200,
      height: 630,
      alt: 'DMDailyDeals: curated daily deals',
    },
  ],
  siteName: 'DMDailyDeals',
  title: 'DMDailyDeals',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
