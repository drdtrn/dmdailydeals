/** The newest `updatedAt` among the given documents, or null when there are none. */
export function newestUpdatedAt(
  docs: readonly { updatedAt?: string | null }[],
  ...extra: (string | null | undefined)[]
): string | null {
  let best: { iso: string; ms: number } | null = null
  for (const iso of [...docs.map((d) => d.updatedAt), ...extra]) {
    if (!iso) continue
    const ms = new Date(iso).getTime()
    if (Number.isNaN(ms)) continue
    if (!best || ms > best.ms) best = { iso, ms }
  }
  return best?.iso ?? null
}
