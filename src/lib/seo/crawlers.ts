/**
 * Crawler names from the vendor docs (plan section C). No imports, so `next.config.ts` can use it.
 *
 * Decision D7: AI training crawlers are allowed. Outdated names (`anthropic-ai`, `Claude-Web`) are
 * deliberately absent.
 */

/** Search and answer crawlers. */
export const SEARCH_CRAWLERS = [
  'Googlebot',
  'Bingbot',
  'OAI-SearchBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Applebot',
  'DuckAssistBot',
  'meta-webindexer',
  'Amzn-SearchBot',
] as const

/** Fetches a person triggers (an assistant opening a link). */
export const USER_FETCH_CRAWLERS = [
  'ChatGPT-User',
  'Claude-User',
  'Perplexity-User',
  'meta-externalfetcher',
  'Amzn-User',
] as const

/** Training crawlers, plus the control tokens `Google-Extended` and `Applebot-Extended`. */
export const TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'CCBot',
  'meta-externalagent',
  'Amazonbot',
  'Google-Extended',
  'Applebot-Extended',
] as const

/**
 * AI crawlers that must get `<title>`, canonical and JSON-LD in the initial `<head>` rather than
 * streamed into `<body>` (appended to Next's `htmlLimitedBots` default). `Google-Extended` and
 * `Applebot-Extended` are robots.txt tokens only; they never send requests, so they are not here.
 */
export const AI_HTML_LIMITED_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'CCBot',
  'meta-externalagent',
  'meta-webindexer',
  'meta-externalfetcher',
  'Amazonbot',
  'Amzn-SearchBot',
  'Amzn-User',
  'DuckAssistBot',
  'Applebot',
] as const

/** Paths no crawler should fetch. */
export const DISALLOWED_PATHS = ['/go/', '/admin', '/api/', '/next/', '/styleguide'] as const

/**
 * Payload serves every uploaded image from /api/media/file/..., which sits under `/api/`. The
 * longer `Allow` wins over `Disallow: /api/` for Google (most specific rule), so product images
 * stay fetchable.
 */
export const ALLOWED_PATHS = ['/', '/api/media/file/'] as const
