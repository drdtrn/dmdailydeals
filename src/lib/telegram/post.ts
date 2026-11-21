import {
  buildCaption,
  buildPicksMessage,
  DROP_BUTTON_TEXT,
  dropUrl,
  type TelegramDeal,
} from './format'
import { telegramCall, TelegramError, type TelegramDeps } from './api'

export type TelegramState = {
  photoMessageId?: number | null
  listMessageId?: number | null
  postedAt?: string | null
}

export type Photo = { data: Uint8Array; filename: string; mimeType: string }

export type DropPost = {
  slug: string
  /** ISO instant on the drop's calendar day. */
  dateIso: string
  hero: TelegramDeal
  picks: TelegramDeal[]
}

export type PostDropArgs = {
  token: string
  channelId: string
  /** Public site origin, no trailing slash. */
  origin: string
  drop: DropPost
  /** What is already stored on the drop. */
  state: TelegramState
  /** Reads the hero image from disk; null (or a throw) means "post text only". */
  loadPhoto: () => Promise<Photo | null>
  /** Persists the state. Called after each message so a retry can skip what is already sent. */
  saveState: (state: TelegramState) => Promise<void>
  deps?: TelegramDeps
  now?: () => Date
}

type SentMessage = { message_id: number }

/**
 * Posts a drop to the channel as two messages, each idempotent on its own:
 *   1. the hero photo (or, without an image, a text message) with the "See today's drop" button;
 *   2. the picks list with the disclosure line.
 * A message whose id is already in `state` is never sent again, so a retry after a partial failure
 * only sends what is missing. Throws on any Telegram error (the job retries); the token never
 * appears in an error.
 */
export async function postDropToTelegram(
  args: PostDropArgs,
): Promise<{ state: TelegramState; sent: ('photo' | 'list')[] }> {
  const { token, channelId, origin, drop, loadPhoto, saveState, deps } = args
  const state: TelegramState = { ...args.state }
  const sent: ('photo' | 'list')[] = []

  if (!state.photoMessageId) {
    const caption = buildCaption({ dropDateIso: drop.dateIso, hero: drop.hero })
    const replyMarkup = {
      inline_keyboard: [[{ text: DROP_BUTTON_TEXT, url: dropUrl(origin, drop.slug) }]],
    }
    const sendText = () =>
      telegramCall<SentMessage>(
        token,
        'sendMessage',
        {
          chat_id: channelId,
          text: caption,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: replyMarkup,
        },
        deps,
      )

    const photo = await loadPhoto().catch(() => null)
    let message: SentMessage
    if (photo) {
      const form = new FormData()
      form.set('chat_id', channelId)
      form.set('caption', caption)
      form.set('parse_mode', 'HTML')
      form.set('reply_markup', JSON.stringify(replyMarkup))
      form.set(
        'photo',
        new Blob([photo.data as BlobPart], { type: photo.mimeType }),
        photo.filename,
      )
      try {
        message = await telegramCall<SentMessage>(token, 'sendPhoto', form, deps)
      } catch (err) {
        // A 400 means Telegram rejected this image (size, dimensions, format). Retrying would fail
        // the same way forever, so post the caption as text instead. Anything else is retried.
        if (err instanceof TelegramError && err.status === 400) message = await sendText()
        else throw err
      }
    } else {
      message = await sendText()
    }
    state.photoMessageId = message.message_id
    await saveState(state)
    sent.push('photo')
  }

  if (!state.listMessageId) {
    const message = await telegramCall<SentMessage>(
      token,
      'sendMessage',
      {
        chat_id: channelId,
        text: buildPicksMessage({ picks: drop.picks, origin }),
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
      deps,
    )
    state.listMessageId = message.message_id
    state.postedAt = (args.now?.() ?? new Date()).toISOString()
    await saveState(state)
    sent.push('list')
  }

  return { state, sent }
}
