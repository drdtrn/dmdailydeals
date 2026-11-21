// @vitest-environment node
import type { Payload } from 'payload'

import crypto from 'node:crypto'

import { REST_GET } from '@payloadcms/next/routes'
import config from '@payload-config'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { runDraft, type DraftDeps } from '@/ai/draft/run'
import { markdownToLexical } from '@/ai/draft/markdown'
import { chat, resolveAiConfig } from '@/ai/provider'
import type { SearchProvider } from '@/ai/search/types'
import { PUBLISH_GATE_MESSAGE } from '@/collections/Posts/hooks/publishGate'

import { clearContent, expectInvalid, getTestPayload, LONG_NOTE, uniq } from '../helpers/db'
import { startMockOpenAi, type RecordedRequest } from '../helpers/mockOpenAi'

// The job-run test goes through the real task wrapper; only the search client is replaced.
const fakeSearch: SearchProvider = {
  name: 'fake',
  search: async (query) => [
    {
      title: `Result for ${query}`,
      url: `https://research.example.org/${encodeURIComponent(query)}`,
      content: 'RAW-SNIPPET-MUST-NOT-BE-STORED',
    },
    {
      title: 'Shared page',
      url: 'https://research.example.org/shared',
      content: 'RAW-SNIPPET-MUST-NOT-BE-STORED',
    },
  ],
}
vi.mock('@/ai/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ai/search')>()),
  getSearchProvider: () => ({ provider: fakeSearch, pricing: { usdPerSearch: 0.008 } }),
}))

let payload: Payload
let categoryId: number
let categorySlug: string
let dealId: number
let dealSlug: string
let authorId: number
let reviewerId: number
let mock: Awaited<ReturnType<typeof startMockOpenAi>> | undefined
const savedEnv = { ...process.env }

const ctx = { disableRevalidate: true }
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

async function createUser(displayName: string | undefined, extra: Record<string, unknown> = {}) {
  return payload.create({
    collection: 'users',
    data: {
      email: `${uniq('u')}@blog-test.example.com`,
      password: crypto.randomBytes(16).toString('hex'),
      displayName,
      ...extra,
    } as never,
    overrideAccess: true,
  })
}

async function setAi(ai: Record<string, unknown>) {
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { ai } as never,
    overrideAccess: true,
    context: ctx,
  })
}

async function aiDraftPost(overrides: Record<string, unknown> = {}) {
  return payload.create({
    collection: 'posts',
    draft: true,
    data: {
      title: uniq('AI guide'),
      slug: uniq('ai-guide'),
      content: await markdownToLexical(payload, '## Hello\n\nBody.'),
      category: categoryId,
      aiAssisted: true,
      _status: 'draft',
      ...overrides,
    } as never,
    overrideAccess: true,
    context: ctx,
  })
}

async function pendingDraftJobs(briefId?: number) {
  const res = await payload.find({
    collection: 'payload-jobs',
    where: { taskSlug: { equals: 'generateBlogDraft' } },
    limit: 100,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return res.docs.filter(
    (j) => briefId === undefined || (j.input as { briefId?: number })?.briefId === briefId,
  )
}

async function cleanup() {
  for (const collection of ['blog-briefs', 'posts'] as const) {
    await payload.delete({
      collection,
      where: { id: { exists: true } },
      overrideAccess: true,
      context: ctx,
    })
  }
  await payload.delete({
    collection: 'payload-jobs',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'users',
    where: { email: { contains: '@blog-test.example.com' } },
    overrideAccess: true,
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  await cleanup()
  await clearContent(payload)
  const store = await payload.create({
    collection: 'stores',
    data: { name: 'Blog Test Shop', domain: 'shop.example.com' } as never,
  })
  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Travel' } as never,
  })
  categoryId = category.id
  categorySlug = category.slug as string
  const title = uniq('carry-on')
  const deal = await payload.create({
    collection: 'deals',
    data: {
      title,
      store: store.id,
      category: categoryId,
      productUrl: `https://shop.example.com/p/${title}`,
      price: 80,
      wasPrice: 120,
      currency: 'USD',
      editorNote: LONG_NOTE,
      status: 'live',
      _status: 'published',
    } as never,
  })
  dealId = deal.id
  dealSlug = deal.slug as string
  authorId = (
    await createUser('Test Author', {
      bio: 'Writes tests.',
      sameAs: [{ url: 'https://example.com/test-author' }],
    })
  ).id
  reviewerId = (await createUser('Test Reviewer')).id
})

afterAll(async () => {
  await mock?.close()
  await setAi({ enabled: false })
  await cleanup()
  await clearContent(payload)
  process.env = savedEnv
})

describe('markdown to Lexical', () => {
  it('converts headings, bold, lists and links with the posts editor', async () => {
    const state = await markdownToLexical(
      payload,
      '## A heading\n\nSome **bold** text and a [link](/esim).\n\n- one\n- two\n\n1. first\n2. second\n\n### Smaller\n\n> quote',
    )
    const nodes = state.root.children as {
      type: string
      tag?: string
      listType?: string
      children?: any[]
    }[]
    expect(nodes[0]).toMatchObject({ type: 'heading', tag: 'h2' })
    const paragraph = nodes[1]
    expect(paragraph.type).toBe('paragraph')
    expect(
      paragraph.children?.some((c) => c.type === 'text' && c.format === 1 && c.text === 'bold'),
    ).toBe(true)
    const link = paragraph.children?.find((c) => c.type === 'link')
    expect(link?.fields?.url).toBe('/esim')
    expect(nodes.find((n) => n.type === 'list' && n.listType === 'bullet')).toBeTruthy()
    expect(nodes.find((n) => n.type === 'list' && n.listType === 'number')).toBeTruthy()
    expect(nodes.find((n) => n.type === 'heading' && n.tag === 'h3')).toBeTruthy()
    expect(nodes.find((n) => n.type === 'quote')).toBeTruthy()
  })

  it('produces content the posts collection accepts', async () => {
    const post = await aiDraftPost()
    expect((post.content.root.children as unknown[]).length).toBeGreaterThan(0)
  })
})

describe('publish gate (decision D8)', () => {
  it('lets an AI-assisted post be saved as a draft without a reviewer', async () => {
    const post = await aiDraftPost()
    expect(post._status).toBe('draft')
    const saved = await payload.update({
      collection: 'posts',
      id: post.id,
      draft: true,
      data: { title: 'Edited draft' },
      overrideAccess: true,
      context: ctx,
    })
    expect(saved.title).toBe('Edited draft')
  })

  it('rejects publishing without reviewedBy: Local API, with and without access control', async () => {
    const post = await aiDraftPost()
    await expectInvalid(
      payload.update({
        collection: 'posts',
        id: post.id,
        data: { _status: 'published' },
        overrideAccess: true,
        context: ctx,
      }),
      new RegExp(PUBLISH_GATE_MESSAGE.slice(0, 40)),
    )
    const staff = await payload.findByID({
      collection: 'users',
      id: authorId,
      overrideAccess: true,
    })
    await expect(
      payload.update({
        collection: 'posts',
        id: post.id,
        data: { _status: 'published' },
        user: staff,
        overrideAccess: false,
        context: ctx,
      }),
    ).rejects.toThrow(/has not been reviewed/)
    await expect(
      payload.create({
        collection: 'posts',
        data: {
          title: 'x',
          slug: uniq('direct'),
          content: await markdownToLexical(payload, 'Hi'),
          aiAssisted: true,
          _status: 'published',
        } as never,
        overrideAccess: true,
        context: ctx,
      }),
    ).rejects.toThrow(/has not been reviewed/)
    const still = await payload.findByID({
      collection: 'posts',
      id: post.id,
      draft: true,
      overrideAccess: true,
    })
    expect(still._status).toBe('draft')
  })

  it('rejects the scheduled-publish job path, and publishes once reviewed', async () => {
    const post = await aiDraftPost()
    await payload.jobs.queue({
      task: 'schedulePublish',
      input: { type: 'publish', doc: { relationTo: 'posts', value: String(post.id) } } as never,
      queue: 'default',
    })
    const blocked = await payload.jobs.run({ queue: 'default' })
    expect(blocked.jobStatus).toBeDefined()
    const failedJobs = await payload.find({
      collection: 'payload-jobs',
      where: { and: [{ taskSlug: { equals: 'schedulePublish' } }, { hasError: { equals: true } }] },
      overrideAccess: true,
      limit: 5,
    })
    expect(failedJobs.docs.length).toBeGreaterThan(0)
    expect(JSON.stringify(failedJobs.docs[0].log)).toContain('has not been reviewed')
    expect(
      (
        await payload.findByID({
          collection: 'posts',
          id: post.id,
          draft: true,
          overrideAccess: true,
        })
      )._status,
    ).toBe('draft')

    // A reviewer is set on the draft; a fresh scheduled publish now goes through.
    await payload.update({
      collection: 'posts',
      id: post.id,
      draft: true,
      data: { reviewedBy: reviewerId },
      overrideAccess: true,
      context: ctx,
    })
    await payload.delete({
      collection: 'payload-jobs',
      where: { id: { exists: true } },
      overrideAccess: true,
    })
    await payload.jobs.queue({
      task: 'schedulePublish',
      input: { type: 'publish', doc: { relationTo: 'posts', value: String(post.id) } } as never,
      queue: 'default',
    })
    await payload.jobs.run({ queue: 'default' })
    const published = await payload.findByID({
      collection: 'posts',
      id: post.id,
      overrideAccess: true,
    })
    expect(published._status).toBe('published')
  })

  it('publishes with reviewedBy and defaults reviewedAt to now', async () => {
    const before = Date.now()
    const post = await aiDraftPost({ reviewedBy: reviewerId })
    expect(post.reviewedAt).toBeTruthy()
    expect(new Date(post.reviewedAt as string).getTime()).toBeGreaterThanOrEqual(before - 1000)
    const published = await payload.update({
      collection: 'posts',
      id: post.id,
      data: { _status: 'published' },
      overrideAccess: true,
      context: ctx,
    })
    expect(published._status).toBe('published')
    expect(published.publishedAt).toBeTruthy()
  })

  it('refuses to remove the reviewer from a published AI-assisted post', async () => {
    const post = await aiDraftPost({ reviewedBy: reviewerId })
    await payload.update({
      collection: 'posts',
      id: post.id,
      data: { _status: 'published' },
      overrideAccess: true,
      context: ctx,
    })
    await expect(
      payload.update({
        collection: 'posts',
        id: post.id,
        data: { reviewedBy: null },
        overrideAccess: true,
        context: ctx,
      }),
    ).rejects.toThrow(/has not been reviewed/)
  })

  it('does not gate a post that is not AI-assisted', async () => {
    const post = await aiDraftPost({ aiAssisted: false })
    const published = await payload.update({
      collection: 'posts',
      id: post.id,
      data: { _status: 'published' },
      overrideAccess: true,
      context: ctx,
    })
    expect(published._status).toBe('published')
  })
})

describe('internal fields never reach the public', () => {
  let publishedSlug: string

  beforeAll(async () => {
    const post = await aiDraftPost({ reviewedBy: reviewerId, author: authorId })
    await payload.update({
      collection: 'posts',
      id: post.id,
      data: { _status: 'published' },
      overrideAccess: true,
      context: ctx,
    })
    publishedSlug = post.slug as string
    await payload.create({
      collection: 'blog-briefs',
      data: {
        topic: 'Linked brief',
        targetKeyword: 'kw',
        category: categoryId,
        experienceSource: 'ai',
        status: 'ready',
        post: post.id,
      } as never,
      overrideAccess: true,
      context: ctx,
    })
  })

  it('staff see the review fields and the brief link; anonymous Local API reads do not', async () => {
    const staff = await payload.find({
      collection: 'posts',
      where: { slug: { equals: publishedSlug } },
      depth: 0,
      overrideAccess: true,
    })
    expect(staff.docs[0].aiAssisted).toBe(true)
    expect(staff.docs[0].reviewedBy).toBe(reviewerId)

    const anon = await payload.find({
      collection: 'posts',
      where: { slug: { equals: publishedSlug } },
      depth: 2,
      draft: false,
      overrideAccess: false,
    })
    expect(anon.docs).toHaveLength(1)
    const json = JSON.stringify(anon.docs[0])
    for (const key of ['aiAssisted', 'reviewedBy', 'reviewedAt', 'brief']) {
      expect(anon.docs[0]).not.toHaveProperty(key)
    }
    expect(json).not.toMatch(/blog-test\.example\.com/) // no author or reviewer email
  })

  it('anonymous REST GET /api/posts has none of them, and exposes only public author fields', async () => {
    const handler = REST_GET(config)
    const res = await handler(new Request('http://localhost:3000/api/posts?limit=100&depth=2'), {
      params: Promise.resolve({ slug: ['posts'] }),
    })
    expect(res.status).toBe(200)
    const text = await res.text()
    const body = JSON.parse(text)
    const post = body.docs.find((d: { slug: string }) => d.slug === publishedSlug)
    expect(post).toBeTruthy()
    for (const key of ['aiAssisted', 'reviewedBy', 'reviewedAt', 'brief'])
      expect(post).not.toHaveProperty(key)
    expect(text).not.toMatch(/aiAssisted|reviewedBy|reviewedAt/)
    expect(text).not.toContain('blog-test.example.com')
    expect(post.populatedAuthor).toMatchObject({
      displayName: 'Test Author',
      bio: 'Writes tests.',
      sameAs: ['https://example.com/test-author'],
    })
    expect(Object.keys(post.populatedAuthor).sort()).toEqual([
      'avatar',
      'bio',
      'displayName',
      'id',
      'sameAs',
    ])
  })

  it('anonymous REST cannot filter or read single docs by the hidden fields either', async () => {
    const handler = REST_GET(config)
    const res = await handler(
      new Request('http://localhost:3000/api/posts?where[aiAssisted][equals]=true&limit=100'),
      { params: Promise.resolve({ slug: ['posts'] }) },
    )
    const text = await res.text()
    expect(text).not.toContain(publishedSlug)
    const briefs = await handler(new Request('http://localhost:3000/api/blog-briefs'), {
      params: Promise.resolve({ slug: ['blog-briefs'] }),
    })
    expect(briefs.status).toBe(403)
    const settings = await handler(new Request('http://localhost:3000/api/globals/site-settings'), {
      params: Promise.resolve({ slug: ['globals', 'site-settings'] }),
    })
    expect(await settings.text()).not.toMatch(/monthlyDraftCap|"ai"/)
  })

  it('does not publish a user as an author unless they have a display name', async () => {
    const nameless = await createUser(undefined)
    const post = await aiDraftPost({ author: nameless.id })
    const read = await payload.findByID({
      collection: 'posts',
      id: post.id,
      draft: true,
      overrideAccess: true,
    })
    expect(read.populatedAuthor).toBeNull()
  })
})

describe('blog briefs', () => {
  const env = () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.TAVILY_API_KEY = 'tvly-test'
  }
  const makeBrief = (data: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'blog-briefs',
      data: {
        topic: uniq('topic'),
        targetKeyword: 'keyword',
        category: categoryId,
        experienceSource: 'ai',
        ...data,
      } as never,
      overrideAccess: true,
      context: ctx,
    })

  beforeEach(async () => {
    env()
    await payload.delete({
      collection: 'blog-briefs',
      where: { id: { exists: true } },
      overrideAccess: true,
      context: ctx,
    })
    await payload.delete({
      collection: 'payload-jobs',
      where: { id: { exists: true } },
      overrideAccess: true,
    })
    await setAi({ enabled: true, provider: 'deepseek', monthlyDraftCap: 20 })
  })

  it('queues exactly one generateBlogDraft job on the ai queue when a brief is created', async () => {
    const brief = await makeBrief()
    expect(brief.status).toBe('queued')
    const jobs = await pendingDraftJobs(brief.id)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ queue: 'ai', taskSlug: 'generateBlogDraft' })
    expect(jobs[0].input).toEqual({ briefId: brief.id })

    // An ordinary edit does not queue again.
    await payload.update({
      collection: 'blog-briefs',
      id: brief.id,
      data: { angle: 'New angle' },
      overrideAccess: true,
      context: ctx,
    })
    expect(await pendingDraftJobs(brief.id)).toHaveLength(1)
  })

  it('setting a failed brief back to queued queues once, and never twice while a job is pending', async () => {
    const brief = await makeBrief()
    await payload.update({
      collection: 'blog-briefs',
      id: brief.id,
      data: { status: 'failed', error: 'x' },
      overrideAccess: true,
      context: ctx,
    })
    await payload.update({
      collection: 'blog-briefs',
      id: brief.id,
      data: { status: 'queued' },
      overrideAccess: true,
      context: ctx,
    })
    // The first job is still pending, so no second one is added.
    expect(await pendingDraftJobs(brief.id)).toHaveLength(1)

    await payload.delete({
      collection: 'payload-jobs',
      where: { id: { exists: true } },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'blog-briefs',
      id: brief.id,
      data: { status: 'failed' },
      overrideAccess: true,
      context: ctx,
    })
    const again = await payload.update({
      collection: 'blog-briefs',
      id: brief.id,
      data: { status: 'queued' },
      overrideAccess: true,
      context: ctx,
    })
    expect(again.error).toBeNull()
    expect(await pendingDraftJobs(brief.id)).toHaveLength(1)
  })

  it('fails the brief with a clear error, and queues nothing, when AI is switched off', async () => {
    await setAi({ enabled: false })
    const brief = await makeBrief()
    expect(brief.status).toBe('failed')
    expect(brief.error).toMatch(/switched off/)
    expect(await pendingDraftJobs()).toHaveLength(0)
  })

  it('fails the brief when the provider key is missing', async () => {
    delete process.env.DEEPSEEK_API_KEY
    const brief = await makeBrief()
    expect(brief.status).toBe('failed')
    expect(brief.error).toMatch(/DEEPSEEK_API_KEY is not set/)
    expect(await pendingDraftJobs()).toHaveLength(0)
  })

  it('fails the brief when the monthly cap is reached', async () => {
    await setAi({ enabled: true, provider: 'deepseek', monthlyDraftCap: 2 })
    const first = await makeBrief()
    const second = await makeBrief()
    const third = await makeBrief()
    expect([first.status, second.status]).toEqual(['queued', 'queued'])
    expect(third.status).toBe('failed')
    expect(third.error).toMatch(/monthly draft cap \(2\)/)
    expect(await pendingDraftJobs()).toHaveLength(2)
    // A failed brief does not use up the cap.
    const fourth = await makeBrief()
    expect(fourth.status).toBe('failed')
  })

  it('requires first-hand notes when the experience source is human', async () => {
    await expectInvalid(
      makeBrief({ experienceSource: 'human', firstHandNotes: '' }),
      /first-hand notes/i,
    )
    const ok = await makeBrief({
      experienceSource: 'human',
      firstHandNotes: 'I flew to Rome with a 5 GB plan and it lasted four days of heavy map use.',
    })
    expect(ok.status).toBe('queued')
  })
})

describe('generateBlogDraft (mocked provider and search; no real API is ever called)', () => {
  const RESEARCH_NOTES =
    '- Fact one [https://research.example.org/q1]\n- Fact two [https://research.example.org/shared]'
  const INSIGHT =
    'Worked scenarios\nA 7-day trip at 1.5 GB per day needs about 10 GB.\nCalculations\n7 x 1.5 = 10.5 GB.\nPractical tips\nCheck the plan.\nCommon pitfalls\nForgetting to activate.'

  const goodDraft = (overrides: Record<string, unknown> = {}) => ({
    title: 'How to choose a travel carry-on',
    slug: uniq('choose-carry-on'),
    metaTitle: 'How to choose a travel carry-on',
    metaDescription:
      'A practical guide to picking a carry-on suitcase: size limits, weight and what to check before you buy.',
    outline: ['Size limits', 'Weight', 'What to check'],
    bodyMarkdown: `## Size limits\n\n${words(280)} See [the carry-on deal](/deal/${dealSlug}) and [travel deals](/deals/${categorySlug}).\n\n## What to check\n\n${words(250)} Based on [this page](https://research.example.org/shared).\n\n- one\n- two`,
    sources: [{ title: 'Shared page', url: 'https://research.example.org/shared' }],
    internalLinks: [
      { anchor: 'the carry-on deal', url: `/deal/${dealSlug}` },
      { anchor: 'travel deals', url: `/deals/${categorySlug}` },
    ],
    suggestedRelatedDealIds: [dealId],
    ...overrides,
  })

  type Script = {
    writer?: (req: RecordedRequest, n: number) => unknown | 'blank' | { status: number }
  }
  let writerCalls = 0

  async function startMock(script: Script = {}) {
    writerCalls = 0
    await mock?.close()
    mock = await startMockOpenAi([
      (req) => {
        const system = String(req.body.messages[0]?.content ?? '')
        const usage = {
          prompt_tokens: 1000,
          completion_tokens: 200,
          prompt_cache_hit_tokens: 400,
          prompt_cache_miss_tokens: 600,
        }
        if (req.body.tools) {
          const toolMessages = req.body.messages.filter((m: any) => m.role === 'tool').length
          if (toolMessages < 2) {
            return {
              content: null,
              toolCalls: [
                {
                  id: `call_${toolMessages}`,
                  name: 'web_search',
                  arguments: JSON.stringify({ query: `q${toolMessages + 1}` }),
                },
              ],
              usage,
            }
          }
          return { content: RESEARCH_NOTES, usage }
        }
        if (system.includes('insight notes')) return { content: INSIGHT, usage }
        writerCalls += 1
        const out = script.writer ? script.writer(req, writerCalls) : goodDraft()
        if (out === 'blank') return { content: '', usage }
        if (out && typeof out === 'object' && 'status' in out) return out as { status: number }
        return { content: JSON.stringify(out), usage }
      },
    ])
  }

  function deps(): DraftDeps {
    return {
      payload,
      config: resolveAiConfig({
        env: {},
        settings: { provider: 'deepseek' },
        overrides: { baseURL: mock!.baseURL, apiKey: 'test-key', maxRetries: 0, timeoutMs: 10_000 },
      }),
      chat,
      search: fakeSearch,
      searchPricing: { usdPerSearch: 0.008 },
      origin: 'http://localhost:3000',
      styleGuide: 'TEST STYLE GUIDE',
    }
  }

  const makeBrief = (data: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'blog-briefs',
      data: {
        topic: 'Choosing a carry-on',
        targetKeyword: 'travel carry-on',
        category: categoryId,
        targetWords: 600,
        experienceSource: 'ai',
        status: 'failed', // keep the queueing hook out of these direct runs
        createdBy: authorId,
        ...data,
      } as never,
      overrideAccess: true,
      context: ctx,
    })

  const postCount = async () =>
    (await payload.count({ collection: 'posts', overrideAccess: true })).totalDocs

  beforeEach(async () => {
    await payload.delete({
      collection: 'blog-briefs',
      where: { id: { exists: true } },
      overrideAccess: true,
      context: ctx,
    })
  })

  it('ai mode: researches, writes insight notes, saves an unpublished AI-assisted draft and records usage', async () => {
    await startMock()
    const brief = await makeBrief()
    const outcome = await runDraft(deps(), brief.id)
    expect(outcome.status).toBe('ready')

    const done = await payload.findByID({
      collection: 'blog-briefs',
      id: brief.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(done.status).toBe('ready')
    expect(done.error).toBeNull()
    expect(done.firstHandNotes).toBe(INSIGHT)
    expect(typeof done.post).toBe('number')

    // Research: queries, URLs and titles and our notes; never the raw snippets.
    const research = done.research as {
      queries: string[]
      results: { title: string; url: string }[]
      notes: string
      searches: number
    }
    expect(research.queries).toEqual(['q1', 'q2'])
    expect(research.searches).toBe(2)
    expect(research.results.map((r) => r.url)).toContain('https://research.example.org/shared')
    expect(research.notes).toBe(RESEARCH_NOTES)
    expect(JSON.stringify(done)).not.toContain('RAW-SNIPPET-MUST-NOT-BE-STORED')

    // Usage: 2 research turns of tool calls + notes turn = 3, insight 1, writer 1.
    const usage = done.usage as Record<string, number | string>
    expect(usage).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-flash',
      calls: 5,
      searches: 2,
    })
    expect(usage.promptTokens).toBe(5000)
    expect(usage.cachedTokens).toBe(2000)
    expect(usage.searchUsd).toBeCloseTo(0.016, 6)
    expect(usage.estimatedUsd as number).toBeCloseTo((usage.modelUsd as number) + 0.016, 6)
    expect(done.estimatedCostUsd).toBeCloseTo(usage.estimatedUsd as number, 6)

    // The draft: never published, AI-assisted, valid sources and links, converted content.
    const post = await payload.findByID({
      collection: 'posts',
      id: done.post as number,
      draft: true,
      depth: 0,
      overrideAccess: true,
    })
    expect(post._status).toBe('draft')
    expect(post.aiAssisted).toBe(true)
    expect(post.reviewedBy ?? null).toBeNull()
    expect(post.publishedAt ?? null).toBeNull()
    expect(post.category).toBe(categoryId)
    expect(post.author).toBe(authorId)
    expect(post.sources?.map((s) => s.url)).toEqual(['https://research.example.org/shared'])
    expect(post.relatedDeals).toEqual([dealId])
    expect(post.meta?.title).toBe('How to choose a travel carry-on')
    const rootTypes = (post.content.root.children as { type: string }[]).map((n) => n.type)
    expect(rootTypes).toEqual(expect.arrayContaining(['heading', 'paragraph', 'list']))
    const links = JSON.stringify(post.content).match(/"url":"([^"]+)"/g)
    expect(links).toEqual(
      expect.arrayContaining([`"url":"/deal/${dealSlug}"`, `"url":"/deals/${categorySlug}"`]),
    )

    // Only the published version is public: the draft is invisible to anonymous reads.
    const anon = await payload.find({
      collection: 'posts',
      where: { slug: { equals: post.slug } },
      draft: false,
      overrideAccess: false,
    })
    expect(anon.docs).toHaveLength(0)

    // The writer saw the provider-specific request shape; the research ran with thinking off.
    expect(mock!.requests[0].body.thinking).toEqual({ type: 'disabled' })
    const writerRequest = mock!.requests.at(-1)!.body
    expect(writerRequest.response_format).toEqual({ type: 'json_object' })
  })

  it('re-running the task creates nothing new and makes no new provider calls', async () => {
    await startMock()
    const brief = await makeBrief()
    const first = await runDraft(deps(), brief.id)
    expect(first.status).toBe('ready')
    const posts = await postCount()
    const requests = mock!.requests.length
    const second = await runDraft(deps(), brief.id)
    expect(second).toMatchObject({
      status: 'skipped',
      postId: (first as { postId: number }).postId,
    })
    expect(await postCount()).toBe(posts)
    expect(mock!.requests.length).toBe(requests)
  })

  it('an already-ready brief set back to queued but with a post just returns to ready', async () => {
    await startMock()
    const brief = await makeBrief()
    await runDraft(deps(), brief.id)
    await payload.update({
      collection: 'blog-briefs',
      id: brief.id,
      data: { status: 'failed' },
      overrideAccess: true,
      context: ctx,
    })
    const requests = mock!.requests.length
    await runDraft(deps(), brief.id)
    expect(
      (
        await payload.findByID({
          collection: 'blog-briefs',
          id: brief.id,
          depth: 0,
          overrideAccess: true,
        })
      ).status,
    ).toBe('ready')
    expect(mock!.requests.length).toBe(requests)
  })

  it("human mode: keeps the person's notes, writes no insight notes and works them into the prompt", async () => {
    await startMock()
    const notes =
      'I flew with this suitcase twelve times and the wheel broke on trip nine; the handle never did.'
    const brief = await makeBrief({ experienceSource: 'human', firstHandNotes: notes })
    const outcome = await runDraft(deps(), brief.id)
    expect(outcome.status).toBe('ready')
    const done = await payload.findByID({
      collection: 'blog-briefs',
      id: brief.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(done.firstHandNotes).toBe(notes)
    const insightCalls = mock!.requests.filter((r) =>
      String(r.body.messages[0]?.content).includes('insight notes'),
    )
    expect(insightCalls).toHaveLength(0)
    const writerPrompt = String(mock!.requests.at(-1)!.body.messages[1].content)
    expect(writerPrompt).toContain(notes)
    expect(writerPrompt).toContain(`/deal/${dealSlug}`)
    const post = await payload.findByID({
      collection: 'posts',
      id: done.post as number,
      draft: true,
      depth: 0,
      overrideAccess: true,
    })
    expect(post.aiAssisted).toBe(true)
    expect(post._status).toBe('draft')
  })

  it('retries once when validation fails (invented link, then fixed) and quotes the problem back', async () => {
    await startMock({
      writer: (_req, n) =>
        n === 1
          ? goodDraft({ internalLinks: [{ anchor: 'x', url: '/deal/invented-deal' }] })
          : goodDraft(),
    })
    const brief = await makeBrief()
    const outcome = await runDraft(deps(), brief.id)
    expect(outcome.status).toBe('ready')
    const writerRequests = mock!.requests.filter((r) => r.body.response_format)
    expect(writerRequests).toHaveLength(2)
    expect(String(writerRequests[1].body.messages.at(-1).content)).toContain(
      '/deal/invented-deal is not in the link inventory',
    )
  })

  it('fails the brief, without a post and without retrying the job, when the draft stays invalid', async () => {
    await startMock({ writer: () => goodDraft({ bodyMarkdown: `## Short\n\n${words(40)}` }) })
    const brief = await makeBrief()
    const before = await postCount()
    const outcome = await runDraft(deps(), brief.id)
    expect(outcome.status).toBe('failed')
    const done = await payload.findByID({
      collection: 'blog-briefs',
      id: brief.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(done.status).toBe('failed')
    expect(done.error).toMatch(/still invalid after one retry/)
    expect(done.error).toMatch(/words/)
    expect(done.post ?? null).toBeNull()
    expect(await postCount()).toBe(before)
    // The money spent is still recorded.
    expect((done.usage as { calls: number }).calls).toBeGreaterThan(3)
  })

  it('fails when the model returns blank content twice', async () => {
    await startMock({ writer: () => 'blank' })
    const brief = await makeBrief()
    expect((await runDraft(deps(), brief.id)).status).toBe('failed')
  })

  it('a provider outage marks the brief failed and throws, so the job retries; research is then reused', async () => {
    await startMock({ writer: () => ({ status: 500 }) })
    const brief = await makeBrief()
    await expect(runDraft(deps(), brief.id)).rejects.toThrow(/DeepSeek request failed/)
    const failed = await payload.findByID({
      collection: 'blog-briefs',
      id: brief.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(failed.status).toBe('failed')
    expect((failed.research as { notes: string }).notes).toBe(RESEARCH_NOTES)

    // The provider recovers; the retry skips research and the insight notes.
    await startMock()
    const retried = await runDraft(deps(), brief.id)
    expect(retried.status).toBe('ready')
    expect(mock!.requests.filter((r) => r.body.tools)).toHaveLength(0)
    expect(mock!.requests).toHaveLength(1)
  })

  it('stops a draft that claims invented first-person experience in the insight notes', async () => {
    await startMock()
    // Replace the insight reply by one with a claim: the guard asks once more, then fails the brief.
    await mock!.close()
    mock = await startMockOpenAi([
      (req) => {
        if (req.body.tools) {
          const n = req.body.messages.filter((m: any) => m.role === 'tool').length
          return n < 1
            ? {
                content: null,
                toolCalls: [{ id: 'c', name: 'web_search', arguments: '{"query":"q1"}' }],
              }
            : { content: RESEARCH_NOTES }
        }
        return { content: 'I tested this suitcase for a week and it was great.' }
      },
    ])
    const brief = await makeBrief()
    expect((await runDraft(deps(), brief.id)).status).toBe('failed')
    const done = await payload.findByID({
      collection: 'blog-briefs',
      id: brief.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(done.error).toMatch(/first-person/)
    expect(done.post ?? null).toBeNull()
  })

  it('runs through the real job: queue, then the ai queue with limit 1', async () => {
    await startMock()
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.TAVILY_API_KEY = 'tvly-test'
    process.env.AI_BASE_URL = mock!.baseURL
    await setAi({ enabled: true, provider: 'deepseek', monthlyDraftCap: 50 })
    await payload.delete({
      collection: 'payload-jobs',
      where: { id: { exists: true } },
      overrideAccess: true,
    })

    const brief = await payload.create({
      collection: 'blog-briefs',
      data: {
        topic: 'Via the queue',
        targetKeyword: 'kw',
        category: categoryId,
        targetWords: 600,
        experienceSource: 'ai',
      } as never,
      overrideAccess: true,
      context: ctx,
    })
    expect(brief.status).toBe('queued')
    await payload.jobs.run({ queue: 'ai', limit: 1 })

    const done = await payload.findByID({
      collection: 'blog-briefs',
      id: brief.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(done.status).toBe('ready')
    expect(typeof done.post).toBe('number')
    delete process.env.AI_BASE_URL
    await setAi({ enabled: false })
  })
})
