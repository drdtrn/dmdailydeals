import { TAVILY_PRICING, TavilySearch } from './tavily'
import type { SearchPricing, SearchProvider } from './types'

export type { SearchProvider, SearchResult, SearchPricing } from './types'
export { TavilySearch, TAVILY_PRICING } from './tavily'

/** The search provider the draft task uses. Returns null (with a reason) when it is not configured. */
export function getSearchProvider(
  env: Record<string, string | undefined> = process.env,
): { provider: SearchProvider; pricing: SearchPricing } | { problem: string } {
  const apiKey = env.TAVILY_API_KEY
  if (!apiKey) return { problem: 'TAVILY_API_KEY is not set in the environment.' }
  return { provider: new TavilySearch({ apiKey }), pricing: TAVILY_PRICING }
}
