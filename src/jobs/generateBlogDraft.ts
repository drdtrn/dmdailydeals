import type { TaskConfig } from 'payload'

import { runDraft } from '../ai/draft/run'
import { aiBlocker } from '../ai/readiness'
import { chat, resolveAiConfig } from '../ai/provider'
import { getSearchProvider } from '../ai/search'
import { siteOrigin } from '../lib/seo/site'

/**
 * Generates a blog draft from a brief (queue `ai`). The work is in `runDraft` (src/ai/draft/run.ts);
 * this wrapper reads the settings, checks the configuration and hands over the real provider and
 * search clients. It never publishes.
 *
 * The queue is run by its own cron loop (`QUEUES=ai`, limit 1, no scheduling, a long timeout), so a
 * slow AI job cannot delay the drop loop. `retries: 2` covers provider and network failures; a
 * draft the model got wrong is not retried (see `runDraft`).
 */
export const generateBlogDraft: TaskConfig<'generateBlogDraft'> = {
  slug: 'generateBlogDraft',
  label: 'Generate a blog draft from a brief',
  retries: 2,
  inputSchema: [{ name: 'briefId', type: 'number', required: true }],
  outputSchema: [
    { name: 'status', type: 'text' },
    { name: 'postId', type: 'number' },
    { name: 'note', type: 'text' },
  ],
  handler: async ({ input, req }) => {
    const { payload } = req
    const settings = await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
    })

    const blocker = aiBlocker(settings.ai)
    if (blocker) {
      await payload
        .update({
          collection: 'blog-briefs',
          id: input.briefId,
          data: { status: 'failed', error: blocker },
          overrideAccess: true,
          context: { disableRevalidate: true },
        })
        .catch(() => undefined)
      return { output: { status: 'failed', note: blocker } }
    }

    const search = getSearchProvider()
    if ('problem' in search) throw new Error(search.problem)

    const outcome = await runDraft(
      {
        payload,
        config: resolveAiConfig({ settings: settings.ai }),
        chat,
        search: search.provider,
        searchPricing: search.pricing,
        origin: siteOrigin(),
      },
      input.briefId,
    )
    return {
      output: {
        status: outcome.status,
        ...('postId' in outcome && outcome.postId !== undefined ? { postId: outcome.postId } : {}),
        ...('error' in outcome ? { note: outcome.error } : {}),
        ...('reason' in outcome ? { note: outcome.reason } : {}),
      },
    }
  },
}
