/**
 * Minimal Telegram Bot API client. The bot token is part of the request URL, so:
 * - it is never put in an error message, a log line or a thrown `cause`;
 * - every message text is scrubbed of the token before it leaves this module.
 */
export class TelegramError extends Error {
  readonly status?: number
  readonly retryAfter?: number
  constructor(message: string, extra: { status?: number; retryAfter?: number } = {}) {
    super(message)
    this.name = 'TelegramError'
    this.status = extra.status
    this.retryAfter = extra.retryAfter
  }
}

export type TelegramDeps = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  /** A 429 asking for at most this many seconds is waited out in place; longer ones throw. */
  maxInlineWaitSeconds?: number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type TelegramResponse<T> = {
  ok: boolean
  result?: T
  error_code?: number
  description?: string
  parameters?: { retry_after?: number }
}

function scrub(text: string, token: string): string {
  return token ? text.split(token).join('[token]') : text
}

/**
 * Calls one Bot API method. `body` is JSON, or a FormData for multipart uploads.
 * - ok: returns `result`.
 * - 429: waits `parameters.retry_after` seconds once if short, otherwise throws (the job retries).
 * - anything else: throws a `TelegramError` with the status and Telegram's description.
 */
export async function telegramCall<T>(
  token: string,
  method: string,
  body: Record<string, unknown> | FormData,
  deps: TelegramDeps = {},
): Promise<T> {
  const doFetch = deps.fetchImpl ?? fetch
  const sleep = deps.sleep ?? defaultSleep
  const maxWait = deps.maxInlineWaitSeconds ?? 15
  const isForm = body instanceof FormData

  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await doFetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: isForm ? undefined : { 'Content-Type': 'application/json' },
        body: isForm ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      // The underlying error can echo the request URL (and so the token): drop it entirely.
      throw new TelegramError(`Telegram ${method} request failed (network error or timeout)`)
    }

    let data: TelegramResponse<T> | null = null
    try {
      data = (await res.json()) as TelegramResponse<T>
    } catch {
      data = null
    }

    if (res.ok && data?.ok) return data.result as T

    const status = data?.error_code ?? res.status
    const retryAfter = data?.parameters?.retry_after
    if (status === 429 && typeof retryAfter === 'number') {
      if (retryAfter <= maxWait && attempt === 0) {
        await sleep((retryAfter + 1) * 1000)
        continue
      }
      throw new TelegramError(
        `Telegram ${method} rate limited (retry_after ${retryAfter}s); the job will retry`,
        { status: 429, retryAfter },
      )
    }
    const description = scrub(data?.description ?? 'no description', token).slice(0, 300)
    throw new TelegramError(`Telegram ${method} failed: ${status} ${description}`, { status })
  }
}
