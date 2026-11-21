/**
 * User-agent check for the click log. Pure.
 *
 * It only decides the `clicks.isBot` flag (the user agent itself is never stored). It errs on the
 * side of flagging: a missing user agent counts as a bot, and so do command-line HTTP clients and
 * headless browsers. The AI crawlers are the ones listed in the plan (§C).
 */

const BOT_PATTERNS: RegExp[] = [
  // Generic markers
  /\b(bot|crawler|spider|crawl|slurp|scraper|fetcher|preview|monitor|checker)\b/i,
  /bot[/;)\s]|bot$/i,
  // Search engines and their helpers
  /googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|storebot-google|feedfetcher/i,
  /bingbot|bingpreview|msnbot|duckduckbot|duckassistbot|baiduspider|yandex|sogou|seznambot|naver|yeti\/|petalbot|applebot|exabot|ia_archiver|archive\.org_bot/i,
  // AI crawlers and agents (search, answers, training)
  /gptbot|oai-searchbot|chatgpt-user|claudebot|claude-searchbot|claude-user|anthropic-ai|perplexitybot|perplexity-user|duckassistbot|meta-webindexer|meta-externalagent|meta-externalfetcher|amzn-searchbot|amazonbot|ccbot|bytespider|cohere-ai|diffbot|youbot|mistralai-user|timpibot|omgili|imagesiftbot|ai2bot|google-extended|applebot-extended/i,
  // Social and chat link unfurlers
  /facebookexternalhit|facebot|twitterbot|slackbot|linkedinbot|discordbot|telegrambot|skypeuripreview|pinterestbot|embedly|redditbot|vkshare|quora link preview/i,
  // SEO and uptime tools
  /ahrefsbot|semrushbot|mj12bot|dotbot|rogerbot|screaming frog|siteaudit|uptimerobot|pingdom|statuscake|site24x7|datadog|newrelic|zabbix|nagios|lighthouse|gtmetrix|pagespeed/i,
  // Headless browsers and automation
  /headlesschrome|headless|phantomjs|puppeteer|playwright|selenium|webdriver|cypress|electron\/|nightmare|slimerjs/i,
  // Command-line and library HTTP clients
  /^(curl|wget|httpie|libwww-perl|lwp-|python-requests|python-urllib|python-httpx|aiohttp|go-http-client|okhttp|java\/|apache-httpclient|node-fetch|undici|axios|got\b|scrapy|php\/|ruby|guzzle|restsharp|postmanruntime|insomnia|http_request2|winhttp|powershell)/i,
  /\b(curl|wget)\//i,
]

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = userAgent?.trim()
  if (!ua) return true
  return BOT_PATTERNS.some((re) => re.test(ua))
}
