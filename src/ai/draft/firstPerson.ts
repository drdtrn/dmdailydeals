/**
 * A cheap guard against invented first-person experience ("I used...", "we tested..."). The AI
 * insight notes are scenarios, calculations, tips and pitfalls drawn from research; they must
 * never claim hands-on use. This is a blunt regex pass, not a classifier: it catches the obvious
 * phrasings so the generator can be asked to try again.
 */

const EXPERIENCE_VERBS =
  'used|tested|tried|bought|purchased|owned|own|ordered|reviewed|ran|measured|stayed|traveled|travelled|visited|flew|installed|activated|wore|swapped|switched|booked|paid|noticed|found|compared|benchmarked|lived|spent'

const SUBJECT = '(?:i|we)'
const ADVERBS =
  "(?:(?:have|had|'ve|also|personally|actually|recently|already|just|both|all|each|always|never|really|finally)\\s+)*"

const PATTERNS: RegExp[] = [
  new RegExp(`\\b${SUBJECT}\\s+${ADVERBS}(?:${EXPERIENCE_VERBS})\\b`, 'i'),
  new RegExp(
    `\\b${SUBJECT}(?:'ve|'d)\\s+(?:been\\s+)?(?:using|testing|trying|running|traveling|travelling)\\b`,
    'i',
  ),
  new RegExp(
    `\\b${SUBJECT}\\s+(?:have|had)\\s+been\\s+(?:using|testing|trying|running|traveling|travelling)\\b`,
    'i',
  ),
  /\b(?:in my|from my|based on my)\s+(?:own\s+)?(?:experience|testing|use|trip|trips|travels)\b/i,
  /\bmy\s+(?:own\s+)?(?:experience|testing|trip|tests?|review|setup)\b/i,
  /\bour\s+(?:own\s+)?(?:testing|tests?|experience|team tested|hands-on)\b/i,
  /\bafter\s+(?:using|testing|trying|owning|living with)\s+(?:it|this|them|these)\s+for\b/i,
]

/** The matched phrases, empty when the text looks clean. */
export function findFirstPersonClaims(text: string): string[] {
  const found: string[] = []
  // Quoted material (a source's own words) is not a claim by us, but keep the guard simple and
  // strict: scan line by line so the report can show the offending sentence.
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    for (const pattern of PATTERNS) {
      const match = sentence.match(pattern)
      if (match) {
        found.push(match[0].trim())
        break
      }
    }
  }
  return [...new Set(found)]
}
