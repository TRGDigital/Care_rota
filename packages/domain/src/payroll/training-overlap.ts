import type { TrainingPaidStatus } from './types'

type Interval = { start: number; end: number }

export type TrainingOverlapInput = {
  sessionStartUtc: string
  sessionEndUtc: string
  shiftIntervals: { startUtc: string; endUtc: string }[]
}

export type TrainingOverlapResult = {
  minutesOverlapping: number
  minutesOutside: number
  paidStatus: TrainingPaidStatus
}

export function computeTrainingOverlap(input: TrainingOverlapInput): TrainingOverlapResult {
  const sessionStart = Date.parse(input.sessionStartUtc)
  const sessionEnd   = Date.parse(input.sessionEndUtc)
  const sessionMins  = (sessionEnd - sessionStart) / 60_000

  if (input.shiftIntervals.length === 0) {
    return { minutesOverlapping: 0, minutesOutside: sessionMins, paidStatus: 'paid_top_up' }
  }

  // Build union of shift intervals that overlap the session
  const session: Interval = { start: sessionStart, end: sessionEnd }
  const shiftUnion = unionIntervals(
    input.shiftIntervals.map(s => ({ start: Date.parse(s.startUtc), end: Date.parse(s.endUtc) }))
  )

  const overlappingMs = shiftUnion.reduce((acc, iv) => {
    const lo = Math.max(iv.start, session.start)
    const hi = Math.min(iv.end, session.end)
    return acc + Math.max(0, hi - lo)
  }, 0)

  const minutesOverlapping = overlappingMs / 60_000
  const minutesOutside = sessionMins - minutesOverlapping

  let paidStatus: TrainingPaidStatus
  if (minutesOverlapping <= 0) {
    paidStatus = 'paid_top_up'
  } else if (minutesOutside <= 0) {
    paidStatus = 'no_top_up'
  } else {
    paidStatus = 'partial'
  }

  return { minutesOverlapping, minutesOutside, paidStatus }
}

function unionIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  if (!sorted[0]) return []
  const result: Interval[] = [{ start: sorted[0].start, end: sorted[0].end }]
  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1]
    const cur = sorted[i]
    if (!cur || !last) continue
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end)
    } else {
      result.push({ start: cur.start, end: cur.end })
    }
  }
  return result
}
