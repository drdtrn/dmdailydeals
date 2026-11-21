import http from 'node:http'
import type { AddressInfo } from 'node:net'

/** One scripted reply of the mock OpenAI-format server (Chat Completions). */
export type MockReply =
  | {
      content: string | null
      toolCalls?: { id: string; name: string; arguments: string }[]
      usage?: Record<string, unknown>
      finishReason?: string
    }
  | { status: number; body?: unknown }

export type RecordedRequest = { path: string; auth: string | undefined; body: Record<string, any> }

/**
 * A local server that speaks the OpenAI Chat Completions format. No real provider is ever called:
 * tests point the `openai` SDK at it through `baseURL`. Replies are scripted in order; a function
 * reply can look at the request body.
 */
export async function startMockOpenAi(
  script: (MockReply | ((req: RecordedRequest) => MockReply))[],
) {
  const requests: RecordedRequest[] = []
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      const recorded: RecordedRequest = {
        path: req.url ?? '',
        auth: req.headers.authorization,
        body: raw ? JSON.parse(raw) : {},
      }
      requests.push(recorded)
      const next = script[Math.min(requests.length - 1, script.length - 1)]
      const reply = typeof next === 'function' ? next(recorded) : next
      if ('status' in reply) {
        res.writeHead(reply.status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(reply.body ?? { error: { message: 'mock error' } }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          created: 0,
          model: recorded.body.model,
          choices: [
            {
              index: 0,
              finish_reason: reply.finishReason ?? (reply.toolCalls ? 'tool_calls' : 'stop'),
              message: {
                role: 'assistant',
                content: reply.content,
                ...(reply.toolCalls
                  ? {
                      tool_calls: reply.toolCalls.map((c) => ({
                        id: c.id,
                        type: 'function',
                        function: { name: c.name, arguments: c.arguments },
                      })),
                    }
                  : {}),
              },
            },
          ],
          usage: reply.usage ?? { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        }),
      )
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return {
    baseURL: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
