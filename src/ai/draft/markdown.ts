import type { Payload } from 'payload'

import {
  convertMarkdownToLexical,
  editorConfigFactory,
  type DefaultTypedEditorState,
} from '@payloadcms/richtext-lexical'

import { postContentEditor } from '../../collections/Posts/editor'

type EditorConfig = Awaited<ReturnType<typeof editorConfigFactory.fromEditor>>
const cache = new WeakMap<object, Promise<EditorConfig>>()

/**
 * Markdown to the Lexical state of a post's `content` field, with the posts editor's own feature
 * set (`@payloadcms/richtext-lexical` 3.94.1: `convertMarkdownToLexical` + `editorConfigFactory`).
 * Headings, bold, italic, lists, links, quotes and code convert; anything the editor has no
 * transformer for stays plain text.
 */
export async function markdownToLexical(
  payload: Payload,
  markdown: string,
): Promise<DefaultTypedEditorState> {
  let editorConfig = cache.get(payload.config)
  if (!editorConfig) {
    editorConfig = editorConfigFactory.fromEditor({
      config: payload.config,
      editor: postContentEditor,
    })
    cache.set(payload.config, editorConfig)
  }
  return convertMarkdownToLexical({
    editorConfig: await editorConfig,
    markdown,
  }) as unknown as DefaultTypedEditorState
}
