import type { ChatFn, ChatMessage, ChatTool } from '../provider'
import type { SearchProvider } from '../search/types'

import { findFirstPersonClaims } from './firstPerson'

export const MAX_SEARCHES = 8
const MAX_TURNS = 14
const SNIPPET_CHARS = 600

/** What is saved on the brief. Search snippets are NOT part of it: only URLs, titles and our notes. */
export type ResearchRecord = {
  provider: string
  queries: string[]
  results: { title: string; url: string }[]
  notes: string
  searches: number
  at: string
}

export const WEB_SEARCH_TOOL: ChatTool = {
  name: 'web_search',
  description:
    'Search the web. Returns up to five results with a title, a URL and a short text snippet. Use specific queries.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: 'The search query.' } },
    required: ['query'],
    additionalProperties: false,
  },
}

export type BriefInput = {
  topic: string
  targetKeyword: string
  angle?: string | null
  categoryName?: string | null
}

const RESEARCH_SYSTEM = `You research facts for a US shopping-guide site (deals on home, tech and travel products).
Find reliable, current information with the web_search tool: official pages, reputable reviews, price and plan details, rules and limits.
Rules:
- Search at most ${MAX_SEARCHES} times. Use specific queries; do not repeat a query.
- When you have enough, stop searching and reply with your research notes as plain text.
- The notes are for a writer. Write them in your own words (never paste snippets), as short bullet points. Put the source URL in brackets after each fact, using only URLs the search tool returned.
- Record numbers (prices, limits, dates) exactly as the source gives them, and say when sources disagree or a figure may be out of date.
- Never invent a fact or a URL. If something could not be confirmed, say so.
- Keep the notes under 600 words.`

function briefText(brief: BriefInput): string {
  return [
    `Topic: ${brief.topic}`,
    `Target keyword: ${brief.targetKeyword}`,
    brief.categoryName ? `Category: ${brief.categoryName}` : null,
    brief.angle ? `Angle: ${brief.angle}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function parseQuery(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { query?: unknown }
    return typeof parsed.query === 'string' && parsed.query.trim() ? parsed.query.trim() : null
  } catch {
    return null
  }
}

/**
 * The research loop: the model calls `web_search` (at most 8 times), then writes notes. Results go
 * back to the model in memory only. The returned record keeps queries, result URLs and titles and
 * the model's own notes.
 */
export async function runResearch(args: {
  brief: BriefInput
  chat: ChatFn
  search: SearchProvider
  maxSearches?: number
}): Promise<ResearchRecord> {
  const { brief, chat, search } = args
  const maxSearches = args.maxSearches ?? MAX_SEARCHES
  const queries: string[] = []
  const results = new Map<string, { title: string; url: string }>()
  let notes = ''

  const messages: ChatMessage[] = [
    { role: 'system', content: RESEARCH_SYSTEM },
    { role: 'user', content: `Research this guide:\n${briefText(brief)}` },
  ]

  for (let turn = 0; turn < MAX_TURNS && !notes; turn++) {
    const exhausted = queries.length >= maxSearches
    const reply = await chat({
      messages,
      // With the budget spent, stop offering the tool so the model has to write its notes.
      tools: exhausted ? undefined : [WEB_SEARCH_TOOL],
      maxTokens: 2500,
    })
    messages.push(reply.message as ChatMessage)

    if (reply.toolCalls.length === 0) {
      const text = (reply.message.content ?? '').trim()
      if (text) notes = text
      else messages.push({ role: 'user', content: 'Write your research notes now.' })
      continue
    }

    for (const call of reply.toolCalls) {
      let content: string
      const query = call.name === 'web_search' ? parseQuery(call.arguments) : null
      if (call.name !== 'web_search') {
        content = JSON.stringify({ error: `Unknown tool ${call.name}.` })
      } else if (!query) {
        content = JSON.stringify({ error: 'Pass {"query": "<text>"}.' })
      } else if (queries.length >= maxSearches) {
        content = JSON.stringify({ error: 'Search limit reached. Write your notes now.' })
      } else {
        queries.push(query)
        try {
          const found = await search.search(query, { maxResults: 5 })
          for (const r of found)
            if (!results.has(r.url)) results.set(r.url, { title: r.title, url: r.url })
          content = JSON.stringify({
            results: found.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.content.slice(0, SNIPPET_CHARS),
            })),
          })
        } catch (err) {
          content = JSON.stringify({
            error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
          })
        }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content })
    }
  }

  if (!notes) {
    // Out of turns without notes: ask once more with no tool on offer.
    messages.push({ role: 'user', content: 'Stop searching. Write your research notes now.' })
    const last = await chat({ messages, maxTokens: 2500 })
    notes = (last.message.content ?? '').trim()
  }
  if (results.size === 0) throw new Error('Research found no sources: the search returned nothing.')
  if (!notes) throw new Error('Research produced no notes.')

  return {
    provider: search.name,
    queries,
    results: [...results.values()],
    notes,
    searches: queries.length,
    at: new Date().toISOString(),
  }
}

// --- Insight notes (experienceSource = ai) -----------------------------------------------------------

const INSIGHT_SYSTEM = `You prepare original material for a shopping guide: concrete insight notes drawn ONLY from the research notes you are given.
Write these four parts, as plain text with the headings "Worked scenarios", "Calculations", "Practical tips" and "Common pitfalls":
- Worked scenarios: two or three realistic situations with the decision spelled out.
- Calculations: cost, data or time arithmetic with the numbers shown. Every input comes from the research notes or is clearly labeled as an assumption.
- Practical tips: specific, actionable, checkable advice.
- Common pitfalls: mistakes people make and how to avoid them.
Hard rules:
- Never claim personal experience. Do not write "I used", "we tested", "I tried", "in my experience" or anything that implies someone used, bought or tested a product. Describe what happens and what to do, in the second person or neutrally.
- Do not invent facts, prices, specs or sources. Anything not in the research notes must be labeled as an assumption.
- Keep it under 500 words.`

/** Insight notes with the first-person guard: one retry that quotes the offending sentences back. */
export async function generateInsightNotes(args: {
  brief: BriefInput
  researchNotes: string
  chat: ChatFn
}): Promise<string> {
  const { brief, researchNotes, chat } = args
  const messages: ChatMessage[] = [
    { role: 'system', content: INSIGHT_SYSTEM },
    {
      role: 'user',
      content: `Guide:\n${briefText(brief)}\n\nResearch notes:\n${researchNotes}\n\nWrite the insight notes.`,
    },
  ]
  let text = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await chat({ messages, maxTokens: 1800 })
    text = (reply.message.content ?? '').trim()
    const claims = text ? findFirstPersonClaims(text) : []
    if (text && claims.length === 0) return text
    messages.push(...(text ? [{ role: 'assistant', content: text } as ChatMessage] : []), {
      role: 'user',
      content: text
        ? `These phrases claim personal experience, which is not allowed: ${claims
            .map((c) => `"${c}"`)
            .join(', ')}. Rewrite the notes without any first-person usage claims.`
        : 'The reply was empty. Write the insight notes now.',
    })
  }
  throw new InvalidDraftError(
    `The insight notes still contained first-person experience claims after one retry: ${findFirstPersonClaims(
      text,
    )
      .slice(0, 3)
      .join('; ')}`,
  )
}

/** A draft that cannot be produced from this input. Retrying the job would only spend more money. */
export class InvalidDraftError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidDraftError'
  }
}
