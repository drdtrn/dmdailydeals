/**
 * Pure drop-selection logic for the `publishDueDrops` task.
 */

export type PlanDrop = {
  id: number | string
  /** Calendar day, `YYYY-MM-DD` (or any ISO string starting with it). */
  date: string
  publishAt?: string | null
}

export type DropPlan = {
  /** The drop to set live, or null when nothing should go live. */
  publish: PlanDrop | null
  /** Drops to archive: every other live drop plus the due drops that lost to a newer one. */
  archiveIds: (number | string)[]
}

const time = (d: PlanDrop) => (d.publishAt ? new Date(d.publishAt).getTime() : 0)
const day = (d: PlanDrop) => d.date.slice(0, 10)

/** Newest first: by publishAt, then by calendar day. */
function newestFirst(a: PlanDrop, b: PlanDrop): number {
  return time(b) - time(a) || day(b).localeCompare(day(a))
}

/**
 * Decides what a run does.
 * - `due`: scheduled drops whose `publishAt` has passed.
 * - `live`: drops currently live.
 *
 * The newest due drop wins and every other due drop is archived without ever going live. Every
 * live drop other than the winner is archived. If a live drop is already newer than the winner
 * (someone back-filled an old day), nothing goes live and the stale due drops are archived, so a
 * back-filled drop can never replace a newer live one.
 * With no due drops the plan is empty: a second run changes nothing.
 */
export function planDropTransition(due: PlanDrop[], live: PlanDrop[]): DropPlan {
  if (due.length === 0) return { publish: null, archiveIds: [] }

  const sorted = [...due].sort(newestFirst)
  const winner = sorted[0]
  const newerLive = live.some((l) => newestFirst(l, winner) < 0)

  if (newerLive) return { publish: null, archiveIds: sorted.map((d) => d.id) }

  return {
    publish: winner,
    archiveIds: [...sorted.slice(1), ...live.filter((l) => l.id !== winner.id)].map((d) => d.id),
  }
}
