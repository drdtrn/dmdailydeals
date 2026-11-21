import {
  BlockquoteFeature,
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
  OrderedListFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'

import { Banner } from '../../blocks/Banner/config'
import { Code } from '../../blocks/Code/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'

/**
 * The editor of a post's `content` field. It is a shared constant because the AI draft task
 * converts markdown to Lexical with this exact editor's feature set (`markdownToLexical`), so
 * generated content always matches what the admin editor can display.
 */
export const postContentEditor = lexicalEditor({
  features: ({ rootFeatures }) => [
    ...rootFeatures,
    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
    BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
    HorizontalRuleFeature(),
    // Guides use lists and quotes; the root editor does not provide them.
    UnorderedListFeature(),
    OrderedListFeature(),
    BlockquoteFeature(),
  ],
})
