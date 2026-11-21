// The Umami tracker (loaded by components/analytics/Umami.tsx) puts `umami` on `window`.
interface Window {
  umami?: {
    track: (event: string, data?: Record<string, string | number | boolean>) => void
  }
}
