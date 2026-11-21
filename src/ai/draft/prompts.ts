import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { ChatMessage } from '../provider'
import { renderInventory } from './inventory'
import type { BriefInput } from './research'
import type { InventoryItem } from './validate'

export const STYLE_GUIDE_PATH = path.join(process.cwd(), 'src', 'ai', 'style-guide.md')

let styleGuide: Promise<string> | undefined

/**
 * `src/ai/style-guide.md`, versioned in git. It is read from disk (the standalone Docker image
 * includes it through `outputFileTracingIncludes` in next.config.ts) and cached per process.
 */
export function loadStyleGuide(file: string = STYLE_GUIDE_PATH): Promise<string> {
  if (file !== STYLE_GUIDE_PATH) return readFile(file, 'utf8')
  styleGuide ??= readFile(file, 'utf8').catch((err: unknown) => {
    styleGuide = undefined
    throw new Error(
      `Could not read the style guide at ${file}: ${err instanceof Error ? err.message : String(err)}`,
    )
  })
  return styleGuide
}

export type WriterInput = {
  brief: BriefInput & { targetWords: number }
  firstHandNotes: string
  researchNotes: string
  sources: { title: string; url: string }[]
  inventory: readonly InventoryItem[]
  mustLinkUrls: readonly string[]
  styleGuide: string
}

/** The messages for the writing call. The reply is requested as json by `chat({ json })`. */
export function buildWriterMessages(input: WriterInput): ChatMessage[] {
  const { brief } = input
  return [
    {
      role: 'system',
      content: `You write guides for DMDailyDeals, a US site that publishes curated daily deals and practical shopping guides. Follow this style guide exactly.\n\n${input.styleGuide}`,
    },
    {
      role: 'user',
      content: [
        '# Brief',
        `Topic: ${brief.topic}`,
        `Target keyword: ${brief.targetKeyword}`,
        brief.categoryName ? `Category: ${brief.categoryName}` : null,
        brief.angle ? `Angle: ${brief.angle}` : null,
        `Length: about ${brief.targetWords} words in bodyMarkdown (between ${Math.ceil(brief.targetWords * 0.8)} and ${Math.floor(brief.targetWords * 1.2)}).`,
        '',
        '# First-hand notes (original material: work these in as real content, keep their meaning)',
        input.firstHandNotes || '(none)',
        '',
        '# Research notes',
        input.researchNotes,
        '',
        '# Sources you may cite (the only allowed external URLs; list the ones you use in "sources")',
        ...input.sources.map((s) => `- ${s.title} | ${s.url}`),
        '',
        '# Link inventory (the only allowed internal links; root-relative paths)',
        renderInventory(input.inventory),
        '',
        '# Must link to',
        input.mustLinkUrls.length > 0
          ? input.mustLinkUrls.map((u) => `- ${u}`).join('\n')
          : '(none)',
        '',
        '# Output',
        'Return the guide as json with these keys: title, slug (lowercase hyphenated), metaTitle, metaDescription, outline (the section headings), bodyMarkdown (markdown, "## " headings, no "# " heading), sources ({title, url}), internalLinks ({anchor, url} for every inventory link used in the body), suggestedRelatedDealIds (deal ids from the inventory that fit the guide, may be empty).',
      ]
        .filter((line) => line !== null)
        .join('\n'),
    },
  ]
}
