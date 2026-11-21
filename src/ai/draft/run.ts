import type { Payload, PayloadRequest } from 'payload'

import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'

import type { BlogBrief } from '../../payload-types'
import { relId } from '../../lib/relId'
import {
  addUsage,
  AiError,
  estimateCostUsd,
  type AiConfig,
  type ChatFn as ProviderChatFn,
  type Usage,
} from '../provider'
import type { SearchPricing, SearchProvider } from '../search/types'
import { loadLinkInventory, loadTakenSlugs, resolveMustLinkUrls } from './inventory'
import { markdownToLexical } from './markdown'
import { buildWriterMessages, loadStyleGuide } from './prompts'
import {
  generateInsightNotes,
  InvalidDraftError,
  runResearch,
  type ResearchRecord,
} from './research'
import { draftSchema, validateDraft, type DraftOutput } from './validate'

export type { ProviderChatFn }

export type DraftDeps = {
  payload: Payload
  config: AiConfig
  chat: ProviderChatFn
  search: SearchProvider
  searchPricing: SearchPricing
  /** The site origin (to recognise absolute links to our own pages). */
  origin: string
  /** Read the style guide from here instead of `src/ai/style-guide.md` (tests). */
  styleGuide?: string
}

export type DraftOutcome =
  | { status: 'ready'; postId: number }
  | { status: 'skipped'; reason: string; postId?: number }
  | { status: 'failed'; error: string }

/** The shape stored in `blog-briefs.usage`. */
export type UsageRecord = {
  provider: string
  model: string
  calls: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  cacheMissTokens: number
  reasoningTokens: number
  searches: number
  modelUsd: number
  searchUsd: number
  estimatedUsd: number
}

export function buildUsageRecord(
  config: Pick<AiConfig, 'provider' | 'model' | 'pricing'>,
  usage: Usage,
  searches: number,
  searchPricing: SearchPricing,
): UsageRecord {
  const modelUsd = estimateCostUsd(usage, config.pricing)
  const searchUsd = Math.round(searches * searchPricing.usdPerSearch * 1e6) / 1e6
  return {
    provider: config.provider,
    model: config.model,
    calls: usage.calls,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    cacheMissTokens: usage.cacheMissTokens,
    reasoningTokens: usage.reasoningTokens,
    searches,
    modelUsd,
    searchUsd,
    estimatedUsd: Math.round((modelUsd + searchUsd) * 1e6) / 1e6,
  }
}

function usageFromRecord(raw: unknown): Usage {
  const r = (raw ?? {}) as Partial<UsageRecord>
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    calls: n(r.calls),
    promptTokens: n(r.promptTokens),
    completionTokens: n(r.completionTokens),
    cachedTokens: n(r.cachedTokens),
    cacheMissTokens: n(r.cacheMissTokens),
    reasoningTokens: n(r.reasoningTokens),
  }
}

const context = { disableRevalidate: true }

async function updateBrief(payload: Payload, id: number, data: Partial<BlogBrief>) {
  await payload.update({
    collection: 'blog-briefs',
    id,
    data: data as never,
    overrideAccess: true,
    context,
  })
}

/**
 * Generates one blog draft from a brief. See `generateBlogDraft` (src/jobs) for the job wrapper.
 *
 * - Idempotent: a brief that already has a post does nothing.
 * - A failure the model caused (an invalid draft) marks the brief `failed` and RETURNS: running
 *   the job again would only pay for the same mistake. Anything else (provider, network, search)
 *   marks it `failed` and throws, so the job's retries can run; research already saved on the brief
 *   is reused, so a retry does not pay for it again.
 * - It never publishes: the post is a draft with `aiAssisted: true`.
 */
export async function runDraft(deps: DraftDeps, briefId: number): Promise<DraftOutcome> {
  const { payload, config } = deps

  const brief = await payload
    .findByID({ collection: 'blog-briefs', id: briefId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!brief) return { status: 'skipped', reason: `Brief ${briefId} no longer exists.` }

  const existingPostId = relId(brief.post)
  if (existingPostId !== undefined) {
    if (brief.status !== 'ready') await updateBrief(payload, briefId, { status: 'ready' })
    return {
      status: 'skipped',
      reason: 'The brief already has a post.',
      postId: Number(existingPostId),
    }
  }

  let usage = usageFromRecord(brief.usage)
  let searches = ((brief.usage as Partial<UsageRecord> | null)?.searches as number | undefined) ?? 0

  const chat: ProviderChatFn = async (args) => {
    try {
      const result = await deps.chat({ ...args, config })
      usage = addUsage(usage, result.usage)
      return result
    } catch (err) {
      if (err instanceof AiError) usage = addUsage(usage, err.usage)
      throw err
    }
  }

  const record = () => buildUsageRecord(config, usage, searches, deps.searchPricing)
  const recordFields = () => {
    const usageRecord = record()
    return { usage: usageRecord as never, estimatedCostUsd: usageRecord.estimatedUsd }
  }

  try {
    await updateBrief(payload, briefId, { status: 'researching', error: null })

    const category =
      typeof brief.category === 'object' && brief.category
        ? brief.category
        : await payload
            .findByID({
              collection: 'categories',
              id: brief.category,
              depth: 0,
              overrideAccess: true,
            })
            .catch(() => null)
    const briefInput = {
      topic: brief.topic,
      targetKeyword: brief.targetKeyword,
      angle: brief.angle,
      categoryName: category?.title ?? null,
    }

    // --- Research (reused when a previous attempt already saved it) ---
    const saved = brief.research as Partial<ResearchRecord> | null
    let research: ResearchRecord
    if (saved?.notes && Array.isArray(saved.results) && saved.results.length > 0) {
      research = saved as ResearchRecord
    } else {
      research = await runResearch({ brief: briefInput, chat, search: deps.search })
      searches += research.searches
      await updateBrief(payload, briefId, { research: research as never, ...recordFields() })
    }

    // --- Insight notes (only when the AI supplies the first-hand material) ---
    let firstHandNotes = (brief.firstHandNotes ?? '').trim()
    if (brief.experienceSource === 'ai' && !firstHandNotes) {
      firstHandNotes = await generateInsightNotes({
        brief: briefInput,
        researchNotes: research.notes,
        chat,
      })
      await updateBrief(payload, briefId, { firstHandNotes, ...recordFields() })
    }

    // --- Writing ---
    await updateBrief(payload, briefId, { status: 'writing', ...recordFields() })
    const [inventory, takenSlugs, mustLinkUrls, styleGuide] = await Promise.all([
      loadLinkInventory(payload),
      loadTakenSlugs(payload),
      resolveMustLinkUrls(payload, brief),
      deps.styleGuide ?? loadStyleGuide(),
    ])
    const targetWords = brief.targetWords ?? 1500
    const researchedUrls = research.results.map((r) => r.url)

    const written = await chat<DraftOutput>({
      messages: buildWriterMessages({
        brief: { ...briefInput, targetWords },
        firstHandNotes,
        researchNotes: research.notes,
        sources: research.results,
        inventory,
        mustLinkUrls,
        styleGuide,
      }),
      json: {
        name: 'blog_draft',
        schema: draftSchema,
        validate: (draft) =>
          validateDraft(draft, {
            origin: deps.origin,
            targetWords,
            inventory,
            researchedUrls,
            takenSlugs,
            mustLinkUrls,
            experienceSource: brief.experienceSource ?? 'ai',
          }),
      },
      maxTokens: Math.max(4000, targetWords * 3),
    }).catch((err: unknown) => {
      if (err instanceof AiError && err.invalidReply) throw new InvalidDraftError(err.message)
      throw err
    })
    const draft = written.data as DraftOutput

    // --- Save: the draft post and the brief's link to it, in one transaction ---
    const content = await markdownToLexical(payload, draft.bodyMarkdown)
    const authorId = relId(brief.createdBy)
    const req: PayloadRequest = await createLocalReq({}, payload)
    await initTransaction(req)
    let postId: number
    try {
      const again = await payload.findByID({
        collection: 'blog-briefs',
        id: briefId,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (again.post) {
        await killTransaction(req)
        return {
          status: 'skipped',
          reason: 'The brief already has a post.',
          postId: Number(relId(again.post)),
        }
      }
      const post = await payload.create({
        collection: 'posts',
        draft: true,
        data: {
          title: draft.title,
          slug: draft.slug,
          _status: 'draft',
          aiAssisted: true,
          category: relId(brief.category) as number,
          ...(authorId !== undefined ? { author: authorId as number } : {}),
          content: content as never,
          sources: draft.sources,
          relatedDeals: draft.suggestedRelatedDealIds,
          meta: { title: draft.metaTitle, description: draft.metaDescription },
        },
        overrideAccess: true,
        context,
        req,
      })
      postId = post.id
      await payload.update({
        collection: 'blog-briefs',
        id: briefId,
        data: { status: 'ready', post: postId, error: null, ...recordFields() } as never,
        overrideAccess: true,
        context,
        req,
      })
      await commitTransaction(req)
    } catch (err) {
      await killTransaction(req)
      throw err
    }
    return { status: 'ready', postId }
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 900)
    await updateBrief(payload, briefId, {
      status: 'failed',
      error: message,
      ...recordFields(),
    }).catch((recordError: unknown) => {
      payload.logger.error({
        err: recordError,
        msg: `Could not record the failure of brief ${briefId}`,
      })
    })
    if (err instanceof InvalidDraftError) return { status: 'failed', error: message }
    throw err
  }
}
