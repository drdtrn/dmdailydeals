import type { SearchPricing, SearchProvider, SearchResult } from './types'

/** `search_depth: 'basic'` costs 1 credit; pay-as-you-go is $0.008 per credit (the free tier is free). */
export const TAVILY_PRICING: SearchPricing = { usdPerSearch: 0.008 }

type TavilyOptions = {
  apiKey: string
  endpoint?: string
  maxResults?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class TavilySearch implements SearchProvider {
  readonly name = 'tavily'

  constructor(private readonly options: TavilyOptions) {}

  async search(
    query: string,
    { maxResults }: { maxResults?: number } = {},
  ): Promise<SearchResult[]> {
    const { apiKey, endpoint = 'https://api.tavily.com/search', timeoutMs = 30_000 } = this.options
    const doFetch = this.options.fetchImpl ?? fetch
    let res: Response
    try {
      res = await doFetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          max_results: maxResults ?? this.options.maxResults ?? 5,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      throw new Error(`Tavily request failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!res.ok) {
      // The body can echo the query but never the key; keep it short.
      const text = (await res.text().catch(() => '')).slice(0, 200)
      throw new Error(`Tavily returned ${res.status}${text ? `: ${text}` : ''}`)
    }
    const json = (await res.json().catch(() => null)) as {
      results?: { title?: unknown; url?: unknown; content?: unknown }[]
    } | null
    return (json?.results ?? []).flatMap((r) =>
      typeof r.url === 'string' && /^https?:\/\//i.test(r.url)
        ? [
            {
              title: typeof r.title === 'string' && r.title ? r.title : r.url,
              url: r.url,
              content: typeof r.content === 'string' ? r.content : '',
            },
          ]
        : [],
    )
  }
}
