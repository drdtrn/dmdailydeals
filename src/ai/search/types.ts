/**
 * Web search behind an interface (plan section D, decision D11), so Brave or Exa can be swapped in
 * without touching the draft task.
 */
export type SearchResult = {
  title: string
  url: string
  /** Text snippet for the model. In-memory only: it is never stored (provider terms, plan section D). */
  content: string
}

export interface SearchProvider {
  readonly name: string
  search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]>
}

/** Estimated USD for one search, for the cost estimate on the brief. */
export type SearchPricing = { usdPerSearch: number }
