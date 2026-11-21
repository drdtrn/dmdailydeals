// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  AiError,
  chat,
  estimateCostUsd,
  parseUsage,
  PROVIDER_CAPABILITIES,
  resolveAiConfig,
  sampleFromJsonSchema,
  type AiConfig,
} from '@/ai/provider'
import { runResearch } from '@/ai/draft/research'
import type { SearchProvider } from '@/ai/search/types'

import { startMockOpenAi, type MockReply } from '../helpers/mockOpenAi'

let closers: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(closers.map((c) => c()))
  closers = []
})

async function setup(
  provider: 'deepseek' | 'openai',
  script: Parameters<typeof startMockOpenAi>[0],
) {
  const server = await startMockOpenAi(script)
  closers.push(server.close)
  const config = resolveAiConfig({
    env: {},
    settings: { provider },
    overrides: { baseURL: server.baseURL, apiKey: 'test-key', maxRetries: 0, timeoutMs: 5_000 },
  })
  return { server, config }
}

const schema = z.object({ title: z.string().min(3), count: z.number().int() })
const json = { name: 'thing', schema }
const messages = [{ role: 'user' as const, content: 'Make a thing.' }]
const ok = (content: unknown, usage?: Record<string, unknown>): MockReply => ({
  content: typeof content === 'string' ? content : JSON.stringify(content),
  usage,
})

describe('resolveAiConfig', () => {
  it('uses the capability table defaults', () => {
    const ds = resolveAiConfig({
      env: { DEEPSEEK_API_KEY: 'k' },
      settings: { provider: 'deepseek' },
    })
    expect(ds).toMatchObject({
      provider: 'deepseek',
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-flash',
      jsonMode: 'json_object',
      maxTokensParam: 'max_tokens',
      apiKey: 'k',
    })
    const oa = resolveAiConfig({ env: { OPENAI_API_KEY: 'o' }, settings: { provider: 'openai' } })
    expect(oa).toMatchObject({
      provider: 'openai',
      model: 'gpt-6-luna',
      jsonMode: 'json_schema',
      maxTokensParam: 'max_completion_tokens',
      apiKey: 'o',
    })
  })

  it('takes the provider from settings, then AI_PROVIDER; model and base URL from env first', () => {
    expect(resolveAiConfig({ env: { AI_PROVIDER: 'openai' } }).provider).toBe('openai')
    expect(
      resolveAiConfig({ env: { AI_PROVIDER: 'openai' }, settings: { provider: 'deepseek' } })
        .provider,
    ).toBe('deepseek')
    expect(resolveAiConfig({ env: {} }).provider).toBe('deepseek')
    const c = resolveAiConfig({
      env: { AI_MODEL: 'env-model', AI_BASE_URL: 'http://gateway.local/v1' },
      settings: { provider: 'openai', model: 'settings-model' },
    })
    expect(c.model).toBe('env-model')
    expect(c.baseURL).toBe('http://gateway.local/v1')
    expect(resolveAiConfig({ env: {}, settings: { model: ' settings-model ' } }).model).toBe(
      'settings-model',
    )
  })

  it('lets any capability value be overridden', () => {
    const c = resolveAiConfig({
      env: {},
      overrides: {
        jsonMode: 'json_schema',
        pricing: { inputMissPerM: 1, inputHitPerM: 0.5, outputPerM: 2 },
      },
    })
    expect(c.jsonMode).toBe('json_schema')
    expect(c.pricing.outputPerM).toBe(2)
    // The shared table itself is untouched.
    expect(PROVIDER_CAPABILITIES.deepseek.jsonMode).toBe('json_object')
  })
})

describe('request shapes per provider config', () => {
  it('DeepSeek: json_object, the word json plus an example, thinking disabled, max_tokens', async () => {
    const { server, config } = await setup('deepseek', [ok({ title: 'Hello', count: 2 })])
    const result = await chat({ messages, json, maxTokens: 777, config })
    expect(result.data).toEqual({ title: 'Hello', count: 2 })

    const body = server.requests[0].body
    expect(server.requests[0].auth).toBe('Bearer test-key')
    expect(server.requests[0].path).toBe('/v1/chat/completions')
    expect(body.model).toBe('deepseek-flash')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.max_tokens).toBe(777)
    expect(body).not.toHaveProperty('max_completion_tokens')
    expect(body).not.toHaveProperty('reasoning_effort')
    const prompt = body.messages.at(-1).content as string
    expect(prompt).toMatch(/json/i)
    expect(prompt).toContain('"title"')
    expect(prompt).toContain('"count"')
  })

  it('OpenAI: strict json_schema, reasoning_effort none, max_completion_tokens, no extra prompt', async () => {
    const { server, config } = await setup('openai', [ok({ title: 'Hello', count: 2 })])
    await chat({ messages, json, maxTokens: 555, config })

    const body = server.requests[0].body
    expect(body.model).toBe('gpt-6-luna')
    expect(body.response_format.type).toBe('json_schema')
    expect(body.response_format.json_schema).toMatchObject({ name: 'thing', strict: true })
    const sent = body.response_format.json_schema.schema
    expect(sent.type).toBe('object')
    expect(sent.additionalProperties).toBe(false)
    expect(sent.required).toEqual(['title', 'count'])
    // Keywords strict mode may reject are stripped from the request (zod still enforces them).
    expect(JSON.stringify(sent)).not.toContain('minLength')
    expect(body.reasoning_effort).toBe('none')
    expect(body.max_completion_tokens).toBe(555)
    expect(body).not.toHaveProperty('thinking')
    expect(body).not.toHaveProperty('max_tokens')
    expect(body.messages).toEqual(messages)
  })

  it('sends no response_format for plain calls but still switches thinking off', async () => {
    const { server, config } = await setup('deepseek', [{ content: 'hi' }])
    const result = await chat({ messages, config })
    expect(result.message.content).toBe('hi')
    expect(server.requests[0].body).not.toHaveProperty('response_format')
    expect(server.requests[0].body.thinking).toEqual({ type: 'disabled' })
  })
})

describe('JSON validation and the single retry', () => {
  it('quotes the zod problems back once and returns the corrected reply', async () => {
    const { server, config } = await setup('deepseek', [
      ok({ title: 'ab', count: 'x' }, { prompt_tokens: 100, completion_tokens: 10 }),
      ok({ title: 'Fixed', count: 3 }, { prompt_tokens: 150, completion_tokens: 12 }),
    ])
    const result = await chat({ messages, json, config })
    expect(result.data).toEqual({ title: 'Fixed', count: 3 })
    expect(server.requests).toHaveLength(2)
    const retry = server.requests[1].body.messages
    expect(retry.at(-2)).toMatchObject({ role: 'assistant' })
    const note = retry.at(-1).content as string
    expect(note).toContain('title')
    expect(note).toContain('count')
    // Usage is summed over both requests.
    expect(result.usage).toMatchObject({ calls: 2, promptTokens: 250, completionTokens: 22 })
  })

  it('fails with AiError after the second bad reply, carrying the usage spent', async () => {
    const { server, config } = await setup('openai', [ok({ nope: true }), ok('not json at all')])
    const error = await chat({ messages, json, config }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AiError)
    expect((error as AiError).invalidReply).toBe(true)
    expect((error as AiError).usage.calls).toBe(2)
    expect((error as AiError).message).toContain('still invalid')
    expect(server.requests).toHaveLength(2)
  })

  it('treats blank content (finish_reason stop) as a failed reply and retries', async () => {
    const { server, config } = await setup('deepseek', [
      { content: '', finishReason: 'stop' },
      { content: null },
      ok({ title: 'unused', count: 1 }),
    ])
    const error = await chat({ messages, json, config }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AiError)
    expect(server.requests).toHaveLength(2)
    // The blank reply is not echoed back as an empty assistant message.
    expect(server.requests[1].body.messages.at(-1).content).toContain('empty')
    expect(
      server.requests[1].body.messages.filter((m: any) => m.role === 'assistant'),
    ).toHaveLength(0)
  })

  it('recovers when the retry after a blank reply is valid', async () => {
    const { config } = await setup('deepseek', [{ content: '' }, ok({ title: 'Second', count: 9 })])
    const result = await chat({ messages, json, config })
    expect(result.data?.title).toBe('Second')
  })

  it('accepts json wrapped in a markdown fence', async () => {
    const { config } = await setup('deepseek', [ok('```json\n{"title":"Fenced","count":1}\n```')])
    expect((await chat({ messages, json, config })).data?.title).toBe('Fenced')
  })

  it('runs json.validate and retries once with its problems', async () => {
    const { server, config } = await setup('openai', [
      ok({ title: 'First try', count: 1 }),
      ok({ title: 'Second try', count: 2 }),
    ])
    const result = await chat({
      messages,
      config,
      json: { ...json, validate: (d) => (d.count < 2 ? ['count must be at least 2'] : []) },
    })
    expect(result.data?.count).toBe(2)
    expect(server.requests[1].body.messages.at(-1).content).toContain('count must be at least 2')
  })

  it('reports a cut-off reply instead of parsing half a document', async () => {
    const { server, config } = await setup('deepseek', [
      { content: '{"title":"Cut', finishReason: 'length' },
      ok({ title: 'Whole', count: 1 }),
    ])
    expect((await chat({ messages, json, config })).data?.title).toBe('Whole')
    expect(server.requests[1].body.messages.at(-1).content).toContain('cut off')
  })

  it('refuses tools and json in one call', async () => {
    const { config } = await setup('deepseek', [ok({})])
    await expect(
      chat({
        messages,
        json,
        config,
        tools: [{ name: 't', description: 'd', parameters: { type: 'object' } }],
      }),
    ).rejects.toThrow(/cannot be combined/)
  })

  it('reports provider errors without leaking the key', async () => {
    const { config } = await setup('deepseek', [
      { status: 401, body: { error: { message: 'bad key' } } },
    ])
    const error = (await chat({ messages, config }).catch((e: unknown) => e)) as AiError
    expect(error).toBeInstanceOf(AiError)
    expect(error.message).toContain('DeepSeek request failed')
    expect(error.message).not.toContain('test-key')
  })

  it('names the missing key when it is not configured', async () => {
    const config = resolveAiConfig({ env: {}, settings: { provider: 'openai' } })
    await expect(chat({ messages, config })).rejects.toThrow(/OPENAI_API_KEY is not set/)
  })
})

describe('usage and cost', () => {
  it('parses the DeepSeek usage fields', () => {
    expect(
      parseUsage({
        prompt_tokens: 1000,
        completion_tokens: 200,
        prompt_cache_hit_tokens: 600,
        prompt_cache_miss_tokens: 400,
        completion_tokens_details: { reasoning_tokens: 50 },
      }),
    ).toEqual({
      calls: 1,
      promptTokens: 1000,
      completionTokens: 200,
      cachedTokens: 600,
      cacheMissTokens: 400,
      reasoningTokens: 50,
    })
  })

  it('parses the OpenAI usage fields', () => {
    expect(
      parseUsage({
        prompt_tokens: 1000,
        completion_tokens: 200,
        prompt_tokens_details: { cached_tokens: 300 },
        completion_tokens_details: { reasoning_tokens: 0 },
      }),
    ).toEqual({
      calls: 1,
      promptTokens: 1000,
      completionTokens: 200,
      cachedTokens: 300,
      cacheMissTokens: 700,
      reasoningTokens: 0,
    })
    expect(parseUsage(undefined)).toMatchObject({ calls: 1, promptTokens: 0, completionTokens: 0 })
  })

  it('estimates cost from the capability table prices', () => {
    const usage = parseUsage({
      prompt_tokens: 30_000,
      completion_tokens: 6_000,
      prompt_cache_hit_tokens: 10_000,
      prompt_cache_miss_tokens: 20_000,
    })
    // DeepSeek flash: 20k miss at $0.30/M + 10k hit at $0.006/M + 6k out at $1.20/M
    expect(estimateCostUsd(usage, PROVIDER_CAPABILITIES.deepseek.pricing)).toBeCloseTo(
      0.006 + 0.00006 + 0.0072,
      6,
    )
    const noCache = parseUsage({ prompt_tokens: 30_000, completion_tokens: 6_000 })
    // OpenAI luna: 30k at $0.10/M + 6k at $0.50/M = $0.006
    expect(estimateCostUsd(noCache, PROVIDER_CAPABILITIES.openai.pricing)).toBeCloseTo(0.006, 6)
  })
})

describe('tool calls', () => {
  const searchTool = {
    name: 'web_search',
    description: 'Search the web.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  }

  it('round-trips a tool call', async () => {
    const { server, config } = await setup('deepseek', [
      {
        content: null,
        toolCalls: [{ id: 'call_1', name: 'web_search', arguments: '{"query":"esim italy"}' }],
      },
      { content: 'Done.' },
    ])
    const first = await chat({ messages, tools: [searchTool], config })
    expect(first.toolCalls).toEqual([
      { id: 'call_1', name: 'web_search', arguments: '{"query":"esim italy"}' },
    ])
    expect(first.message.tool_calls).toHaveLength(1)

    const second = await chat({
      messages: [
        ...messages,
        first.message,
        { role: 'tool', tool_call_id: 'call_1', content: '{"results":[]}' },
      ],
      tools: [searchTool],
      config,
    })
    expect(second.message.content).toBe('Done.')
    expect(second.toolCalls).toEqual([])

    const sent = server.requests[0].body
    expect(sent.tools).toEqual([{ type: 'function', function: searchTool }])
    expect(sent.tool_choice).toBe('auto')
    expect(sent.thinking).toEqual({ type: 'disabled' })
    const history = server.requests[1].body.messages
    expect(history.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call_1' })
    expect(history.at(-2).tool_calls[0].id).toBe('call_1')
  })
})

describe('switching provider changes only the request, not the task code', () => {
  const search: SearchProvider = {
    name: 'fake',
    search: async () => [{ title: 'A page', url: 'https://example.org/a', content: 'snippet' }],
  }
  const script = (): Parameters<typeof startMockOpenAi>[0] => [
    {
      content: null,
      toolCalls: [{ id: 'c1', name: 'web_search', arguments: '{"query":"q one"}' }],
    },
    { content: '- A fact [https://example.org/a]' },
  ]

  async function research(provider: 'deepseek' | 'openai') {
    const { server, config } = await setup(provider, script())
    const record = await runResearch({
      brief: { topic: 'Topic', targetKeyword: 'kw' },
      chat: (args) => chat({ ...args, config }),
      search,
    })
    return { record, requests: server.requests, config: config as AiConfig }
  }

  it('runs the same research task against both providers', async () => {
    const [ds, oa] = await Promise.all([research('deepseek'), research('openai')])
    expect(ds.record.queries).toEqual(['q one'])
    expect({ ...oa.record, at: '' }).toEqual({ ...ds.record, at: '' })
    expect(ds.requests[0].body.thinking).toEqual({ type: 'disabled' })
    expect(oa.requests[0].body.reasoning_effort).toBe('none')
    expect(ds.requests[0].body.model).not.toBe(oa.requests[0].body.model)
  })
})

describe('sampleFromJsonSchema', () => {
  it('builds an example with the shape of the schema', () => {
    const s = z.toJSONSchema(
      z.object({ a: z.string(), b: z.array(z.object({ c: z.number() })), d: z.enum(['x', 'y']) }),
    )
    expect(sampleFromJsonSchema(s)).toEqual({ a: 'string', b: [{ c: 0 }], d: 'x' })
  })
})
