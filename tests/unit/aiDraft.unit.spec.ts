// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { findFirstPersonClaims } from '@/ai/draft/firstPerson'
import { buildWriterMessages, STYLE_GUIDE_PATH } from '@/ai/draft/prompts'
import { aiBlocker, capBlocker, monthStartUtc } from '@/ai/readiness'
import { TavilySearch } from '@/ai/search/tavily'
import {
  countWords,
  draftSchema,
  extractMarkdownLinks,
  normalizeUrl,
  validateDraft,
  type DraftContext,
  type DraftOutput,
} from '@/ai/draft/validate'
import { buildUsageRecord } from '@/ai/draft/run'
import { emptyUsage, resolveAiConfig } from '@/ai/provider'

const ORIGIN = 'https://dmdailydeals.test'

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

const ctx: DraftContext = {
  origin: ORIGIN,
  targetWords: 100,
  inventory: [
    { url: '/deals/travel', label: 'Travel deals (hub)', kind: 'category' },
    { url: '/deal/carry-on', label: 'Carry-on', kind: 'deal', id: 7 },
    { url: '/esim', label: 'eSIM', kind: 'page' },
  ],
  researchedUrls: ['https://example.org/guide', 'https://other.example.net/plans/'],
  takenSlugs: new Set(['taken-slug']),
  mustLinkUrls: [],
  experienceSource: 'human',
}

function draft(overrides: Partial<DraftOutput> = {}): DraftOutput {
  return {
    title: 'How to pick a travel eSIM',
    slug: 'how-to-pick-a-travel-esim',
    metaTitle: 'How to pick a travel eSIM',
    metaDescription:
      'A practical guide to choosing a travel eSIM plan: data needs, price per GB and what to check first.',
    outline: ['Why', 'How much data', 'Compare'],
    bodyMarkdown: `## Why\n\n${words(40)} [our eSIM page](/esim) and [the carry-on](/deal/carry-on).\n\n## Data\n\n${words(55)} per [the guide](https://example.org/guide/).`,
    sources: [{ title: 'The guide', url: 'https://example.org/guide' }],
    internalLinks: [{ anchor: 'our eSIM page', url: '/esim' }],
    suggestedRelatedDealIds: [7],
    ...overrides,
  }
}

describe('draftSchema', () => {
  it('accepts a complete draft', () => {
    expect(draftSchema.safeParse(draft()).success).toBe(true)
  })

  it('rejects missing fields, bad slugs and bad source URLs', () => {
    const { title: _title, ...rest } = draft()
    expect(draftSchema.safeParse(rest).success).toBe(false)
    expect(draftSchema.safeParse(draft({ slug: 'Not A Slug' })).success).toBe(false)
    expect(
      draftSchema.safeParse(draft({ sources: [{ title: 'x', url: 'not a url' }] })).success,
    ).toBe(false)
    expect(draftSchema.safeParse(draft({ suggestedRelatedDealIds: [1.5] })).success).toBe(false)
    expect(draftSchema.safeParse(draft({ sources: [] })).success).toBe(false)
  })
})

describe('normalizeUrl and links', () => {
  it('makes our own absolute URLs root-relative and tidies external ones', () => {
    expect(normalizeUrl(`${ORIGIN}/deal/x/`, ORIGIN)).toBe('/deal/x')
    expect(normalizeUrl('/deal/x#top', ORIGIN)).toBe('/deal/x')
    expect(normalizeUrl(ORIGIN, ORIGIN)).toBe('/')
    expect(normalizeUrl('https://Example.org/a/#frag', ORIGIN)).toBe('https://example.org/a')
  })

  it('extracts markdown links', () => {
    expect(
      extractMarkdownLinks('See [one](/a) and [two](https://x.org/b "title") but not text.'),
    ).toEqual([
      { anchor: 'one', url: '/a' },
      { anchor: 'two', url: 'https://x.org/b' },
    ])
  })
})

describe('countWords', () => {
  it('ignores link syntax, heading marks and list markers', () => {
    expect(countWords('## Heading here\n\n- one two\n- three [four five](/x) six')).toBe(8)
  })
})

describe('validateDraft', () => {
  const run = (d: DraftOutput, over: Partial<DraftContext> = {}) =>
    validateDraft(d, { ...ctx, ...over })

  it('passes a clean draft', () => {
    expect(run(draft())).toEqual([])
  })

  it('flags internal links that are not in the inventory', () => {
    expect(
      run(draft({ internalLinks: [{ anchor: 'x', url: '/deal/invented' }] })).join('\n'),
    ).toContain('internalLinks url /deal/invented is not in the link inventory')
    const body = `## A\n\n${words(95)} [made up](/deal/invented).`
    expect(run(draft({ bodyMarkdown: body })).join('\n')).toContain(
      'the body links to /deal/invented',
    )
  })

  it('accepts an absolute link to our own inventory page', () => {
    const body = `## A\n\n${words(95)} [esim](${ORIGIN}/esim).`
    expect(run(draft({ bodyMarkdown: body }))).toEqual([])
  })

  it('requires sources to be a subset of the researched URLs', () => {
    const problems = run(
      draft({ sources: [{ title: 'Made up', url: 'https://invented.example.com/x' }] }),
    )
    expect(problems.join('\n')).toContain('was not among the researched URLs')
    // Trailing slash and case differences are the same page.
    const body = `## A\n\n${words(95)} [plans](https://other.example.net/plans/).`
    expect(
      run(
        draft({
          bodyMarkdown: body,
          sources: [{ title: 'Plans', url: 'https://Other.example.net/plans' }],
        }),
      ),
    ).toEqual([])
  })

  it('enforces the word count within 20% of the target', () => {
    const short = run(draft({ bodyMarkdown: `## A\n\n${words(50)}` }))
    expect(short.join('\n')).toMatch(/the body has 51 words; it must be between 80 and 120/)
    const long = run(draft({ bodyMarkdown: `## A\n\n${words(150)}` }))
    expect(long.join('\n')).toContain('it must be between 80 and 120')
    // The heading word counts: 1 + 79 = 80 is the lower bound, 1 + 78 is one short.
    expect(run(draft({ bodyMarkdown: `## A\n\n${words(79)}` }))).toEqual([])
    expect(run(draft({ bodyMarkdown: `## A\n\n${words(78)}` })).length).toBe(1)
  })

  it('flags a slug that is already taken', () => {
    expect(run(draft({ slug: 'taken-slug' })).join('\n')).toContain(
      'slug "taken-slug" is already used',
    )
  })

  it('flags related deal ids that are not in the inventory', () => {
    expect(run(draft({ suggestedRelatedDealIds: [7, 99] })).join('\n')).toContain('contains 99')
  })

  it('requires the must-link pages in the body', () => {
    expect(run(draft(), { mustLinkUrls: ['/deals/travel'] }).join('\n')).toContain(
      'must link to /deals/travel',
    )
    const body = `## A\n\n${words(95)} [travel](/deals/travel).`
    expect(run(draft({ bodyMarkdown: body }), { mustLinkUrls: ['/deals/travel'] })).toEqual([])
  })

  it('rejects an h1, FAQ headings and statements about how the guide was made', () => {
    expect(run(draft({ bodyMarkdown: `# Title\n\n${words(95)}` })).join('\n')).toContain(
      '"# " heading',
    )
    expect(run(draft({ bodyMarkdown: `## FAQ\n\n${words(95)}` })).join('\n')).toContain('FAQ')
    expect(
      run(draft({ bodyMarkdown: `## A\n\n${words(90)} This guide was written by an AI.` })).join(
        '\n',
      ),
    ).toContain('how the guide was produced')
  })

  it('applies the first-person guard to the body only in ai mode', () => {
    const body = `## A\n\n${words(90)} I tested this plan in Rome.`
    expect(run(draft({ bodyMarkdown: body }), { experienceSource: 'human' })).toEqual([])
    expect(run(draft({ bodyMarkdown: body }), { experienceSource: 'ai' }).join('\n')).toContain(
      'first-person usage claims',
    )
  })
})

describe('findFirstPersonClaims', () => {
  it.each([
    'I used this plan in Italy.',
    'We tested five SIM cards last month.',
    "I've been using it every day.",
    'In my experience the signal is weak.',
    'After using it for a week, the battery held up.',
    'We personally tried the app.',
    'I bought the 10 GB plan.',
    'Our testing showed a drop.',
  ])('catches: %s', (text) => {
    expect(findFirstPersonClaims(text).length).toBeGreaterThan(0)
  })

  it.each([
    'A 7-day trip at 1.5 GB per day needs about 10 GB.',
    'You should compare the price per gigabyte.',
    'Many travelers use a local SIM; this is the cheaper option for long stays.',
    'We publish one drop a day.',
    'The plan includes 5 GB of data, according to the provider.',
  ])('lets through: %s', (text) => {
    expect(findFirstPersonClaims(text)).toEqual([])
  })
})

describe('Tavily search provider', () => {
  it('posts the documented request and maps results', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const search = new TavilySearch({
      apiKey: 'tvly-test',
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return Response.json({
          results: [
            { title: 'One', url: 'https://one.example.com/', content: 'snippet one', score: 0.9 },
            { title: '', url: 'https://two.example.com/x', content: 'snippet two' },
            { title: 'Bad', url: 'javascript:alert(1)', content: 'x' },
          ],
        })
      }) as typeof fetch,
    })
    const results = await search.search('best travel esim')
    expect(calls[0].url).toBe('https://api.tavily.com/search')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer tvly-test')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      query: 'best travel esim',
      search_depth: 'basic',
      max_results: 5,
    })
    expect(results).toEqual([
      { title: 'One', url: 'https://one.example.com/', content: 'snippet one' },
      {
        title: 'https://two.example.com/x',
        url: 'https://two.example.com/x',
        content: 'snippet two',
      },
    ])
  })

  it('throws on an error status without echoing the key', async () => {
    const search = new TavilySearch({
      apiKey: 'tvly-secret',
      fetchImpl: (async () =>
        new Response('quota exceeded', { status: 429 })) as unknown as typeof fetch,
    })
    const error = (await search.search('q').catch((e: unknown) => e)) as Error
    expect(error.message).toContain('429')
    expect(error.message).not.toContain('tvly-secret')
  })
})

describe('readiness and cap', () => {
  const env = { DEEPSEEK_API_KEY: 'k', TAVILY_API_KEY: 't' }

  it('blocks when AI is off, a key is missing, or the cap is reached', () => {
    expect(aiBlocker(undefined, env)).toMatch(/switched off/)
    expect(aiBlocker({ enabled: false }, env)).toMatch(/switched off/)
    expect(aiBlocker({ enabled: true }, { TAVILY_API_KEY: 't' })).toMatch(
      /DEEPSEEK_API_KEY is not set/,
    )
    expect(aiBlocker({ enabled: true, provider: 'openai' }, env)).toMatch(
      /OPENAI_API_KEY is not set/,
    )
    expect(aiBlocker({ enabled: true }, { DEEPSEEK_API_KEY: 'k' })).toMatch(/TAVILY_API_KEY/)
    expect(aiBlocker({ enabled: true }, env)).toBeNull()
    expect(capBlocker(20, 20)).toMatch(/cap \(20\)/)
    expect(capBlocker(19, 20)).toBeNull()
    expect(capBlocker(0, 0)).toMatch(/cap \(0\)/)
    expect(capBlocker(5, undefined)).toBeNull()
  })

  it('starts the cap window on the first of the month in UTC', () => {
    expect(monthStartUtc(new Date('2026-11-21T23:59:00Z')).toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    )
  })
})

describe('usage record', () => {
  it('prices model tokens from the config and searches from the search pricing', () => {
    const config = resolveAiConfig({ env: {}, settings: { provider: 'deepseek' } })
    const usage = {
      ...emptyUsage(),
      calls: 3,
      promptTokens: 30_000,
      cacheMissTokens: 30_000,
      completionTokens: 6_000,
    }
    const record = buildUsageRecord(config, usage, 8, { usdPerSearch: 0.008 })
    expect(record).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-flash',
      searches: 8,
      calls: 3,
    })
    expect(record.modelUsd).toBeCloseTo(0.009 + 0.0072, 6)
    expect(record.searchUsd).toBeCloseTo(0.064, 6)
    expect(record.estimatedUsd).toBeCloseTo(0.009 + 0.0072 + 0.064, 6)
  })
})

describe('style guide and writer prompt', () => {
  it('exists in git and carries the required rules', () => {
    expect(existsSync(STYLE_GUIDE_PATH)).toBe(true)
    const guide = readFileSync(STYLE_GUIDE_PATH, 'utf8')
    for (const rule of [
      /US English/,
      /Never invent facts, prices/,
      /Cite sources/,
      /firstHandNotes/,
      /Link ONLY to URLs from the link inventory/,
      /statement about how the guide was produced/,
      /Do NOT write an FAQ section/,
    ]) {
      expect(guide).toMatch(rule)
    }
  })

  it('puts the brief, notes, sources, inventory and must-link pages into the prompt', () => {
    const messages = buildWriterMessages({
      brief: {
        topic: 'eSIMs for Italy',
        targetKeyword: 'italy esim',
        targetWords: 1500,
        categoryName: 'Travel',
      },
      firstHandNotes: 'NOTE-MARKER',
      researchNotes: 'RESEARCH-MARKER',
      sources: [{ title: 'Src', url: 'https://example.org/guide' }],
      inventory: ctx.inventory,
      mustLinkUrls: ['/esim'],
      styleGuide: 'STYLE-MARKER',
    })
    const text = messages.map((m) => String(m.content)).join('\n')
    for (const marker of [
      'STYLE-MARKER',
      'NOTE-MARKER',
      'RESEARCH-MARKER',
      'italy esim',
      'https://example.org/guide',
      '/deal/carry-on | deal id=7',
      '- /esim',
    ]) {
      expect(text).toContain(marker)
    }
    expect(text).toMatch(/between 1200 and 1800/)
  })
})
