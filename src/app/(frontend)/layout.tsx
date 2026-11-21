import type { Metadata, Viewport } from 'next'
import { Bodoni_Moda, DM_Sans } from 'next/font/google'
import { draftMode } from 'next/headers'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { themeInitScript } from '@/components/theme/theme'
import { getServerSideURL } from '@/utilities/getURL'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { cn } from '@/utilities/ui'

import './globals.css'

// UI face. The opsz axis lets small text and large numerals each get their own optical design.
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  axes: ['opsz'],
})

// Display face: matches the high-contrast Didone D/M monogram. Italic is used for the drop date.
const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni-moda',
  display: 'swap',
  style: ['normal', 'italic'],
  axes: ['opsz'],
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    <html className={cn(dmSans.variable, bodoniModa.variable)} lang="en" suppressHydrationWarning>
      <head>
        {/* Restores a saved light/dark choice before first paint (see components/theme). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only z-50 bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <AdminBar
          adminBarProps={{
            preview: isEnabled,
          }}
        />
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  title: 'DMDailyDeals',
  description:
    'A fresh set of curated deals across home, tech and travel, every day at 9:00 AM ET.',
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  // The masthead is ink in both themes, so the browser chrome matches it.
  themeColor: '#0B0B0C',
}
