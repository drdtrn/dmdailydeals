import type { SiteSetting } from '../payload-types'

import { aiConfigProblem, resolveAiConfig } from './provider'

type Env = Record<string, string | undefined>

/**
 * Why a draft cannot be generated right now, or null when it can. Used by the brief hook (to fail a
 * new brief at once, with a clear message) and again by the task (settings can change between
 * queueing and running). Only the provider layer decides what "complete" means for the provider.
 */
export function aiBlocker(
  ai: SiteSetting['ai'] | null | undefined,
  env: Env = process.env,
): string | null {
  if (!ai?.enabled) {
    return 'AI drafts are switched off. Turn them on in Site settings (AI blog drafts) and queue the brief again.'
  }
  const config = resolveAiConfig({ env, settings: ai })
  const problem = aiConfigProblem(config)
  if (problem) return `${config.label}: ${problem}`
  if (!env.TAVILY_API_KEY) return 'TAVILY_API_KEY is not set in the environment.'
  return null
}

/** Start of the current calendar month in UTC (the monthly draft cap window). */
export function monthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export function capBlocker(
  startedThisMonth: number,
  cap: number | null | undefined,
): string | null {
  const limit = typeof cap === 'number' ? cap : 20
  if (startedThisMonth >= limit) {
    return `The monthly draft cap (${limit}) is reached. Raise it in Site settings or wait until next month, then queue the brief again.`
  }
  return null
}
