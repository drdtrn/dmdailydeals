/**
 * The AI provider layer (plan section D, decision D10).
 *
 * THIS IS THE ONLY FILE THAT KNOWS WHICH PROVIDER IS IN USE. Everything that differs between
 * DeepSeek and OpenAI is a value in the capability table below (base URL, default model, JSON mode,
 * how to switch thinking off, the max-token parameter name, prices). Task code calls `chat()` and
 * `estimateCostUsd()` and never branches on a provider name.
 *
 * It uses the official `openai` SDK on Chat Completions with a configurable `baseURL`. It does NOT
 * use the SDK's `zodResponseFormat` / `.parse` helpers, because those always send `json_schema`,
 * which DeepSeek does not document. JSON is requested in the provider's supported mode and then
 * validated with zod here, with one retry that quotes the problems back to the model.
 *
 * Prices and model ids change: re-check them (plan section D) before turning the feature on.
 */
import OpenAI from 'openai'
import { z } from 'zod'

// --- Capability table -------------------------------------------------------------------------------

export const PROVIDER_IDS = ['deepseek', 'openai'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)

/** USD per one million tokens. `inputMiss` is the normal input rate, `inputHit` the cached rate. */
export type Pricing = { inputMissPerM: number; inputHitPerM: number; outputPerM: number }

export type ProviderCapabilities = {
  label: string
  baseURL: string
  /** Name of the environment variable that holds the API key. */
  apiKeyEnv: string
  defaultModel: string
  /** `json_object`: the prompt must say "json" and show an example. `json_schema`: strict schema. */
  jsonMode: 'json_object' | 'json_schema'
  /** Extra request fields that switch reasoning off (tool loops need this on DeepSeek). */
  thinkingOff: Record<string, unknown>
  /** The name of the output-token limit parameter. */
  maxTokensParam: 'max_tokens' | 'max_completion_tokens'
  pricing: Pricing
}

/** Defaults from the 2026-11-21 discovery pass. Every value is overridable through `resolveAiConfig`. */
export const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapabilities> = {
  deepseek: {
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-flash',
    jsonMode: 'json_object',
    thinkingOff: { thinking: { type: 'disabled' } },
    maxTokensParam: 'max_tokens',
    // Flash, peak hours (off-peak is half).
    pricing: { inputMissPerM: 0.3, inputHitPerM: 0.006, outputPerM: 1.2 },
  },
  openai: {
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-6-luna',
    jsonMode: 'json_schema',
    thinkingOff: { reasoning_effort: 'none' },
    maxTokensParam: 'max_completion_tokens',
    pricing: { inputMissPerM: 0.1, inputHitPerM: 0.01, outputPerM: 0.5 },
  },
}

export type AiConfig = ProviderCapabilities & {
  provider: ProviderId
  apiKey: string | undefined
  model: string
  /** Per request, in milliseconds. */
  timeoutMs: number
  /** SDK-level retries (429, 5xx, connection errors). */
  maxRetries: number
}

/** The choices that live in `site-settings.ai`. */
export type AiSettings = { provider?: string | null; model?: string | null } | null | undefined

export type ResolveOptions = {
  env?: Record<string, string | undefined>
  settings?: AiSettings
  /** Replace any capability value (tests, or a provider quirk found later). */
  overrides?: Partial<ProviderCapabilities> & {
    timeoutMs?: number
    maxRetries?: number
    apiKey?: string
  }
}

/**
 * Precedence: provider = site-settings, then `AI_PROVIDER`, then deepseek. Model = `AI_MODEL`, then
 * site-settings, then the provider default. `AI_BASE_URL` overrides the base URL. Secrets come
 * from the environment only.
 */
export function resolveAiConfig({
  env = process.env,
  settings,
  overrides,
}: ResolveOptions = {}): AiConfig {
  const fromSettings = settings?.provider
  const fromEnv = env.AI_PROVIDER
  const provider: ProviderId = isProviderId(fromSettings)
    ? fromSettings
    : isProviderId(fromEnv)
      ? fromEnv
      : 'deepseek'
  const caps = PROVIDER_CAPABILITIES[provider]
  const { timeoutMs, maxRetries, apiKey, ...capOverrides } = overrides ?? {}
  return {
    ...caps,
    ...capOverrides,
    provider,
    apiKey: apiKey ?? env[capOverrides.apiKeyEnv ?? caps.apiKeyEnv],
    baseURL: capOverrides.baseURL ?? (env.AI_BASE_URL?.trim() || caps.baseURL),
    model:
      capOverrides.defaultModel ??
      (env.AI_MODEL?.trim() || settings?.model?.trim() || caps.defaultModel),
    timeoutMs: timeoutMs ?? 180_000,
    maxRetries: maxRetries ?? 2,
  }
}

/** A human-readable reason the config cannot be used, or null when it is complete. */
export function aiConfigProblem(config: AiConfig): string | null {
  if (!config.apiKey) return `${config.apiKeyEnv} is not set in the environment.`
  return null
}

// --- Usage and cost ---------------------------------------------------------------------------------

export type Usage = {
  calls: number
  promptTokens: number
  completionTokens: number
  /** Prompt tokens served from the provider's cache (billed at the cached rate). */
  cachedTokens: number
  /** Prompt tokens billed at the normal input rate. */
  cacheMissTokens: number
  /** Included in `completionTokens` already; reported for information. */
  reasoningTokens: number
}

export const emptyUsage = (): Usage => ({
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  cachedTokens: 0,
  cacheMissTokens: 0,
  reasoningTokens: 0,
})

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    calls: a.calls + b.calls,
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    cachedTokens: a.cachedTokens + b.cachedTokens,
    cacheMissTokens: a.cacheMissTokens + b.cacheMissTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
  }
}

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0

/**
 * Reads the `usage` object of either provider:
 * - DeepSeek: `prompt_cache_hit_tokens`, `prompt_cache_miss_tokens`,
 *   `completion_tokens_details.reasoning_tokens`.
 * - OpenAI: `prompt_tokens_details.cached_tokens`, `completion_tokens_details.reasoning_tokens`.
 */
export function parseUsage(raw: unknown): Usage {
  const u = (raw ?? {}) as Record<string, unknown>
  const promptTokens = num(u.prompt_tokens)
  const completionTokens = num(u.completion_tokens)
  const hasDeepseekCache = 'prompt_cache_hit_tokens' in u || 'prompt_cache_miss_tokens' in u
  const details = (u.prompt_tokens_details ?? {}) as Record<string, unknown>
  const cachedTokens = Math.min(
    promptTokens,
    hasDeepseekCache ? num(u.prompt_cache_hit_tokens) : num(details.cached_tokens),
  )
  const cacheMissTokens =
    hasDeepseekCache && 'prompt_cache_miss_tokens' in u
      ? num(u.prompt_cache_miss_tokens)
      : Math.max(promptTokens - cachedTokens, 0)
  const completionDetails = (u.completion_tokens_details ?? {}) as Record<string, unknown>
  return {
    calls: 1,
    promptTokens,
    completionTokens,
    cachedTokens,
    cacheMissTokens,
    reasoningTokens: num(completionDetails.reasoning_tokens),
  }
}

/** Estimated USD for the model calls (searches are costed separately). Rounded to 6 places. */
export function estimateCostUsd(usage: Usage, pricing: Pricing): number {
  const usd =
    (usage.cacheMissTokens / 1e6) * pricing.inputMissPerM +
    (usage.cachedTokens / 1e6) * pricing.inputHitPerM +
    (usage.completionTokens / 1e6) * pricing.outputPerM
  return Math.round(usd * 1e6) / 1e6
}

// --- Chat -------------------------------------------------------------------------------------------

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam
export type AssistantMessage = {
  role: 'assistant'
  content: string | null
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
}

export type ChatTool = {
  name: string
  description: string
  /** A JSON Schema object. */
  parameters: Record<string, unknown>
}

export type ToolCall = { id: string; name: string; arguments: string }

export type JsonRequest<T> = {
  /** Used as the schema name in `json_schema` mode. */
  name: string
  schema: z.ZodType<T>
  /** Extra checks after zod passes; return a list of problems (empty = fine). */
  validate?: (data: T) => string[]
}

export type ChatArgs<T = never> = {
  messages: ChatMessage[]
  tools?: ChatTool[]
  json?: JsonRequest<T>
  maxTokens?: number
  config?: AiConfig
}

export type ChatResult<T = never> = {
  /** The assistant message, ready to append to the history on the next turn. */
  message: AssistantMessage
  toolCalls: ToolCall[]
  /** Summed over every request this call made (a JSON retry makes two). */
  usage: Usage
  finishReason: string | null
  /** Parsed and validated, only when `json` was requested. */
  data?: T
}

export type ChatFn = <T = never>(args: ChatArgs<T>) => Promise<ChatResult<T>>

/** A failed chat call. It carries the usage already spent, so the caller can still record it. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly usage: Usage = emptyUsage(),
    /** True for problems in the reply (bad JSON); false for transport and config problems. */
    readonly invalidReply = false,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

const clients = new Map<string, OpenAI>()

function clientFor(config: AiConfig): OpenAI {
  const problem = aiConfigProblem(config)
  if (problem) throw new AiError(problem)
  const key = `${config.baseURL}|${config.timeoutMs}|${config.maxRetries}|${config.apiKey}`
  let client = clients.get(key)
  if (!client) {
    client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
      maxRetries: config.maxRetries,
    })
    clients.set(key, client)
  }
  return client
}

/** JSON Schema for the model (and for the example). The `$schema` marker is dropped. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _marker, ...rest } = z.toJSONSchema(schema, { io: 'output' }) as Record<
    string,
    unknown
  >
  return rest
}

/** Keywords strict `json_schema` mode may reject. zod still enforces them locally. */
const STRICT_UNSUPPORTED = new Set([
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'pattern',
  'format',
  'default',
  'multipleOf',
])

function stripForStrict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripForStrict)
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([key]) => !STRICT_UNSUPPORTED.has(key))
        .map(([key, value]) => [key, stripForStrict(value)]),
    )
  }
  return node
}

/** A made-up value that has the shape of a JSON Schema, for the "example" in a json_object prompt. */
export function sampleFromJsonSchema(node: unknown): unknown {
  const schema = (node ?? {}) as Record<string, unknown>
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0]
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type
  switch (type) {
    case 'object': {
      const props = (schema.properties ?? {}) as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(props).map(([key, value]) => [key, sampleFromJsonSchema(value)]),
      )
    }
    case 'array':
      return [sampleFromJsonSchema(schema.items)]
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return true
    case 'string':
      return typeof schema.description === 'string' ? schema.description : 'string'
    default:
      return null
  }
}

function jsonInstruction(schema: Record<string, unknown>): string {
  return [
    'Reply with a single json object and nothing else: no markdown fences, no commentary.',
    'It must match this JSON Schema:',
    JSON.stringify(schema),
    'Example of the expected shape (the values are placeholders):',
    JSON.stringify(sampleFromJsonSchema(schema)),
  ].join('\n')
}

/** Strips a markdown fence the model may wrap around JSON despite the instructions. */
function unfence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return (match ? match[1] : text).trim()
}

function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    return `${path}: ${issue.message}`
  })
}

type RawResponse = {
  choices?: {
    message?: {
      content?: string | null
      tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
    }
    finish_reason?: string | null
  }[]
  usage?: unknown
}

async function requestOnce(
  config: AiConfig,
  messages: ChatMessage[],
  options: { tools?: ChatTool[]; responseFormat?: Record<string, unknown>; maxTokens?: number },
): Promise<{
  message: AssistantMessage
  toolCalls: ToolCall[]
  usage: Usage
  finishReason: string | null
}> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    ...config.thinkingOff,
    ...(options.maxTokens ? { [config.maxTokensParam]: options.maxTokens } : {}),
    ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    ...(options.tools && options.tools.length > 0
      ? {
          tools: options.tools.map((tool) => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
          tool_choice: 'auto',
        }
      : {}),
  }

  let response: RawResponse
  try {
    response = (await clientFor(config).chat.completions.create(body as never)) as RawResponse
  } catch (err) {
    if (err instanceof AiError) throw err
    // The SDK's messages never contain the API key. Keep the status and the provider's reason.
    const message = err instanceof Error ? err.message : String(err)
    throw new AiError(`${config.label} request failed: ${message}`)
  }

  const choice = response.choices?.[0]
  const raw = choice?.message
  const toolCalls = (raw?.tool_calls ?? [])
    .filter((call) => call.type === 'function')
    .map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    }))
  const message: AssistantMessage = {
    role: 'assistant',
    content: typeof raw?.content === 'string' ? raw.content : null,
    ...(raw?.tool_calls && raw.tool_calls.length > 0 ? { tool_calls: raw.tool_calls } : {}),
  }
  return {
    message,
    toolCalls,
    usage: parseUsage(response.usage),
    finishReason: choice?.finish_reason ?? null,
  }
}

/**
 * One chat turn, in OpenAI request format, against whichever provider the config selects.
 *
 * - Thinking is always switched off (the config's `thinkingOff`): tool loops need it on DeepSeek
 *   (otherwise `reasoning_content` must be echoed back), and the drafts don't need it.
 * - `tools` and `json` cannot be combined in one call.
 * - With `json`, the reply is parsed and checked with zod (and `json.validate`). If it is blank,
 *   not JSON or invalid, ONE retry quotes the problems back. A second failure throws `AiError`.
 */
export async function chat<T = never>(args: ChatArgs<T>): Promise<ChatResult<T>> {
  const config = args.config ?? resolveAiConfig()
  const { json } = args
  if (json && args.tools && args.tools.length > 0) {
    throw new AiError('chat(): tools and json cannot be combined in one call.')
  }

  if (!json) {
    const result = await requestOnce(config, args.messages, {
      tools: args.tools,
      maxTokens: args.maxTokens,
    })
    return result as ChatResult<T>
  }

  const schema = jsonSchemaOf(json.schema)
  const responseFormat =
    config.jsonMode === 'json_schema'
      ? {
          type: 'json_schema',
          json_schema: { name: json.name, strict: true, schema: stripForStrict(schema) },
        }
      : { type: 'json_object' }

  // json_object: the prompt itself must ask for json and show the shape.
  const baseMessages: ChatMessage[] =
    config.jsonMode === 'json_object'
      ? [...args.messages, { role: 'user', content: jsonInstruction(schema) }]
      : args.messages

  let messages = baseMessages
  let usage = emptyUsage()
  let lastProblems: string[] = []

  for (let attempt = 0; attempt < 2; attempt++) {
    let result
    try {
      result = await requestOnce(config, messages, {
        responseFormat,
        maxTokens: args.maxTokens,
      })
    } catch (err) {
      if (err instanceof AiError)
        throw new AiError(err.message, addUsage(usage, err.usage), err.invalidReply)
      throw err
    }
    usage = addUsage(usage, result.usage)

    const content = result.message.content ?? ''
    let problems: string[] = []
    let data: T | undefined
    if (!content.trim()) {
      problems = ['The reply was empty.']
    } else if (result.finishReason === 'length') {
      problems = ['The reply was cut off before the json object was complete. Make it shorter.']
    } else {
      let parsed: unknown
      try {
        parsed = JSON.parse(unfence(content))
      } catch {
        problems = ['The reply was not valid json.']
      }
      if (problems.length === 0) {
        const checked = json.schema.safeParse(parsed)
        if (!checked.success) {
          problems = describeIssues(checked.error)
        } else {
          problems = json.validate?.(checked.data) ?? []
          if (problems.length === 0) data = checked.data
        }
      }
    }

    if (data !== undefined) {
      return {
        message: result.message,
        toolCalls: [],
        usage,
        finishReason: result.finishReason,
        data,
      }
    }

    lastProblems = problems
    messages = [
      ...baseMessages,
      ...(content.trim() ? [{ role: 'assistant', content } as ChatMessage] : []),
      {
        role: 'user',
        content: `Your previous reply had these problems:\n${problems
          .map((p) => `- ${p}`)
          .join('\n')}\nReply again with only the corrected json object.`,
      },
    ]
  }

  throw new AiError(
    `The model's reply was still invalid after one retry: ${lastProblems.slice(0, 8).join('; ')}`,
    usage,
    true,
  )
}
