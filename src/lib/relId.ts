/** The id of a relationship value, whether it is populated or not. */
export function relId(value: unknown): number | string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'object') {
    const id = (value as { id?: number | string }).id
    return id ?? undefined
  }
  return value as number | string
}
