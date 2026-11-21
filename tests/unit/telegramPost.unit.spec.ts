import { describe, expect, it, vi } from 'vitest'

import { telegramCall, TelegramError } from '../../src/lib/telegram/api'
import { postDropToTelegram, type DropPost, type TelegramState } from '../../src/lib/telegram/post'

const TOKEN = '123456:SECRET-token_abc'
const ORIGIN = 'https://dmdailydeals.com'

const drop: DropPost = {
  slug: '2026-11-21',
  dateIso: '2026-11-21T12:00:00.000Z',
  hero: { title: 'Hero deal', slug: 'hero-deal', price: 50, wasPrice: 100, currency: 'USD' },
  picks: [{ title: 'Pick one', slug: 'pick-one', price: 20, wasPrice: null, currency: 'USD' }],
}

type Call = { method: string; body: unknown; form?: FormData }

/** A fake Bot API. `script` can answer specific calls; otherwise every call succeeds. */
function fakeTelegram(script: (call: Call, n: number) => Response | undefined = () => undefined) {
  const calls: Call[] = []
  let nextId = 100
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).split('/').pop() as string
    const isForm = init?.body instanceof FormData
    const call: Call = {
      method,
      body: isForm ? undefined : JSON.parse(String(init?.body)),
      form: isForm ? (init!.body as FormData) : undefined,
    }
    calls.push(call)
    const scripted = script(call, calls.length)
    if (scripted) return scripted
    return Response.json({ ok: true, result: { message_id: nextId++ } })
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

/** Awaits a promise that must reject and returns the error. */
const thrown = async (p: Promise<unknown>) =>
  (await p.then(
    () => null,
    (e: unknown) => e,
  )) as TelegramError

const error = (code: number, description: string, parameters?: object) =>
  Response.json({ ok: false, error_code: code, description, parameters }, { status: code })

function run(
  fake: ReturnType<typeof fakeTelegram>,
  over: {
    state?: TelegramState
    photo?: boolean
    saved?: TelegramState[]
    sleep?: (ms: number) => Promise<void>
  } = {},
) {
  const saved = over.saved ?? []
  return postDropToTelegram({
    token: TOKEN,
    channelId: '@dmdailydeals',
    origin: ORIGIN,
    drop,
    state: over.state ?? {},
    loadPhoto: async () =>
      over.photo === false
        ? null
        : { data: new Uint8Array([1, 2, 3]), filename: 'hero.jpg', mimeType: 'image/jpeg' },
    saveState: async (s) => {
      saved.push({ ...s })
    },
    deps: { fetchImpl: fake.fetchImpl, sleep: over.sleep ?? (async () => {}) },
    now: () => new Date('2026-11-21T14:00:00.000Z'),
  })
}

describe('postDropToTelegram', () => {
  it('uploads the hero photo as multipart with a button, then sends the picks list', async () => {
    const fake = fakeTelegram()
    const saved: TelegramState[] = []
    const { state, sent } = await run(fake, { saved })

    expect(fake.calls.map((c) => c.method)).toEqual(['sendPhoto', 'sendMessage'])
    expect(sent).toEqual(['photo', 'list'])

    const photo = fake.calls[0].form!
    expect(photo.get('chat_id')).toBe('@dmdailydeals')
    expect(photo.get('parse_mode')).toBe('HTML')
    expect(photo.get('photo')).toBeInstanceOf(Blob)
    expect(String(photo.get('caption'))).toContain('Hero deal')
    expect(JSON.parse(String(photo.get('reply_markup')))).toEqual({
      inline_keyboard: [[{ text: 'See today’s drop', url: `${ORIGIN}/drops/2026-11-21` }]],
    })

    const list = fake.calls[1].body as Record<string, unknown>
    expect(list).toMatchObject({ chat_id: '@dmdailydeals', parse_mode: 'HTML' })
    expect(list.link_preview_options).toEqual({ is_disabled: true })
    expect(list).not.toHaveProperty('disable_web_page_preview')
    expect(list).not.toHaveProperty('reply_markup')
    expect(String(list.text)).toContain(`${ORIGIN}/deal/pick-one`)
    expect(String(list.text)).toContain('Paid links: we may earn a commission')

    expect(state).toMatchObject({
      photoMessageId: 100,
      listMessageId: 101,
      postedAt: '2026-11-21T14:00:00.000Z',
    })
    // State is saved after each message, not only at the end.
    expect(saved).toHaveLength(2)
    expect(saved[0]).toEqual({ photoMessageId: 100 })
  })

  it('falls back to sendMessage (with the button) when the drop has no image', async () => {
    const fake = fakeTelegram()
    await run(fake, { photo: false })
    expect(fake.calls.map((c) => c.method)).toEqual(['sendMessage', 'sendMessage'])
    const first = fake.calls[0].body as Record<string, unknown>
    expect(first.reply_markup).toBeTruthy()
    expect(first.link_preview_options).toEqual({ is_disabled: true })
  })

  it('posts the caption as text when Telegram rejects the image (400)', async () => {
    const fake = fakeTelegram((call) =>
      call.method === 'sendPhoto' ? error(400, 'Bad Request: PHOTO_INVALID_DIMENSIONS') : undefined,
    )
    const { state } = await run(fake)
    expect(fake.calls.map((c) => c.method)).toEqual(['sendPhoto', 'sendMessage', 'sendMessage'])
    expect(state.photoMessageId).toBe(100)
  })

  it('does not re-send a stored photo: a retry only sends the list', async () => {
    const fake = fakeTelegram()
    await run(fake, { state: { photoMessageId: 55 } })
    expect(fake.calls.map((c) => c.method)).toEqual(['sendMessage'])
    expect(String((fake.calls[0].body as { text: string }).text)).toContain('Pick one')
  })

  it('after a list failure, the retry sends only the list', async () => {
    const saved: TelegramState[] = []
    const failing = fakeTelegram((call, n) => (n === 2 ? error(500, 'oops') : undefined))
    await expect(run(failing, { saved })).rejects.toThrow(/sendMessage failed: 500/)
    expect(failing.calls.map((c) => c.method)).toEqual(['sendPhoto', 'sendMessage'])
    expect(saved).toEqual([{ photoMessageId: 100 }])

    const retry = fakeTelegram()
    const { state } = await run(retry, { state: saved.at(-1) })
    expect(retry.calls.map((c) => c.method)).toEqual(['sendMessage'])
    expect(state.photoMessageId).toBe(100)
    expect(state.listMessageId).toBe(100)
  })

  it('sends nothing when both messages are already stored', async () => {
    const fake = fakeTelegram()
    const { sent } = await run(fake, { state: { photoMessageId: 1, listMessageId: 2 } })
    expect(fake.calls).toHaveLength(0)
    expect(sent).toEqual([])
  })
})

describe('telegramCall', () => {
  it('waits out a short retry_after once, then succeeds', async () => {
    const sleeps: number[] = []
    const fake = fakeTelegram((_, n) =>
      n === 1 ? error(429, 'Too Many Requests', { retry_after: 3 }) : undefined,
    )
    const result = await telegramCall<{ message_id: number }>(
      TOKEN,
      'sendMessage',
      { a: 1 },
      {
        fetchImpl: fake.fetchImpl,
        sleep: async (ms) => {
          sleeps.push(ms)
        },
      },
    )
    expect(result.message_id).toBe(100)
    expect(fake.calls).toHaveLength(2)
    expect(sleeps).toEqual([4000])
  })

  it('throws on a long retry_after without waiting, so the job retries later', async () => {
    const sleep = vi.fn(async () => {})
    const fake = fakeTelegram(() => error(429, 'Too Many Requests', { retry_after: 600 }))
    const err = await thrown(
      telegramCall(
        TOKEN,
        'sendMessage',
        {},
        {
          fetchImpl: fake.fetchImpl,
          sleep,
        },
      ),
    )
    expect(err).toBeInstanceOf(TelegramError)
    expect(err.retryAfter).toBe(600)
    expect(err.status).toBe(429)
    expect(sleep).not.toHaveBeenCalled()
    expect(fake.calls).toHaveLength(1)
  })

  it('throws if it is rate limited again after waiting', async () => {
    const fake = fakeTelegram(() => error(429, 'Too Many Requests', { retry_after: 1 }))
    await expect(
      telegramCall(TOKEN, 'sendMessage', {}, { fetchImpl: fake.fetchImpl, sleep: async () => {} }),
    ).rejects.toThrow(/rate limited/)
    expect(fake.calls).toHaveLength(2)
  })

  it('throws on other non-ok responses', async () => {
    const fake = fakeTelegram(() =>
      error(403, 'Forbidden: bot is not a member of the channel chat'),
    )
    await expect(
      telegramCall(TOKEN, 'sendMessage', {}, { fetchImpl: fake.fetchImpl }),
    ).rejects.toThrow(/403 Forbidden/)
  })

  it('never puts the bot token in an error, even if the network error echoes the URL', async () => {
    const leaky = vi.fn(async (url: string | URL | Request) => {
      throw new TypeError(`fetch failed for ${String(url)}`)
    }) as unknown as typeof fetch
    const err = await thrown(telegramCall(TOKEN, 'sendPhoto', new FormData(), { fetchImpl: leaky }))
    expect(err).toBeInstanceOf(TelegramError)
    expect(String(err.message)).not.toContain(TOKEN)
    expect(String(err.stack)).not.toContain(TOKEN)
    expect(err.cause).toBeUndefined()

    const fake = fakeTelegram(() => error(401, `Unauthorized (token ${TOKEN})`))
    const err2 = await thrown(telegramCall(TOKEN, 'sendMessage', {}, { fetchImpl: fake.fetchImpl }))
    expect(String(err2.message)).not.toContain(TOKEN)
  })
})
