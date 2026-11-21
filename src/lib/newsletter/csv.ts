import type { Payload } from 'payload'

export const SUBSCRIBER_CSV_COLUMNS = [
  'email',
  'status',
  'source',
  'consentAt',
  'consentText',
  'createdAt',
] as const

/**
 * One CSV cell. Quotes when needed (RFC 4180) and neutralises spreadsheet formulas: a cell that
 * starts with = + - @ (or a tab or CR) gets a leading apostrophe so Excel and Sheets treat it as text.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',')
}

/** All subscribers as CSV (CRLF line ends, header first, oldest signup first). */
export async function subscribersCsv(payload: Payload): Promise<string> {
  const lines = [csvRow([...SUBSCRIBER_CSV_COLUMNS])]
  let page = 1
  for (;;) {
    const res = await payload.find({
      collection: 'subscribers',
      sort: 'createdAt',
      limit: 1000,
      page,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of res.docs) {
      lines.push(csvRow(SUBSCRIBER_CSV_COLUMNS.map((column) => doc[column])))
    }
    if (!res.hasNextPage) break
    page++
  }
  return `${lines.join('\r\n')}\r\n`
}
