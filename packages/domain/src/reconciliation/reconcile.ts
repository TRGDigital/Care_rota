import type {
  ClockingEvent, PlannedShift, ReconciliationResult, PayableMinutes,
} from './types'

const MATCH_WINDOW_MS    = 15 * 60 * 1000   // 15 min
const NO_SHOW_GRACE_MS   = 30 * 60 * 1000   // 30 min (configurable via homes.no_show_grace_minutes)
const NO_CLOCK_OUT_MS    = 90 * 60 * 1000   // 90 min after planned end

type Pair = { inTime: Date; outTime: Date | null }

/** FIFO pairing of clock_in / clock_out events */
function pairClockings(events: ClockingEvent[]): Pair[] {
  const sorted = [...events]
    .filter(e => e.event_type === 'clock_in' || e.event_type === 'clock_out')
    .sort((a, b) => new Date(a.event_time_utc).getTime() - new Date(b.event_time_utc).getTime())

  const pairs: Pair[] = []
  let openIn: Date | null = null

  for (const e of sorted) {
    if (e.event_type === 'clock_in') {
      openIn = new Date(e.event_time_utc)
    } else if (e.event_type === 'clock_out' && openIn) {
      pairs.push({ inTime: openIn, outTime: new Date(e.event_time_utc) })
      openIn = null
    }
  }
  // Unclosed clock-in
  if (openIn) pairs.push({ inTime: openIn, outTime: null })
  return pairs
}

/** Sum all disturbed_start / disturbed_end pairs */
function sumDisturbedMinutes(events: ClockingEvent[]): number {
  const disturbed = events
    .filter(e => e.event_type === 'disturbed_start' || e.event_type === 'disturbed_end')
    .sort((a, b) => new Date(a.event_time_utc).getTime() - new Date(b.event_time_utc).getTime())

  let total = 0
  let start: Date | null = null
  for (const e of disturbed) {
    if (e.event_type === 'disturbed_start') {
      start = new Date(e.event_time_utc)
    } else if (e.event_type === 'disturbed_end' && start) {
      total += (new Date(e.event_time_utc).getTime() - start.getTime()) / 60_000
      start = null
    }
  }
  return Math.round(total)
}

/**
 * Classify the shift type for payable minutes.
 * Uses planned start/end UTC to determine weekday vs weekend, night, etc.
 */
function classifyMinutes(
  startUtc: Date,
  endUtc: Date,
  isBankHoliday: boolean,
  isSleepIn: boolean,
  breakMinutes: number,
): PayableMinutes {
  const workedMs   = endUtc.getTime() - startUtc.getTime()
  const workedMins = Math.max(0, Math.round(workedMs / 60_000) - breakMinutes)

  // Night = 22:00–06:00 UTC (simplified; production uses home timezone)
  const startHour = startUtc.getUTCHours()
  const isNight   = startHour >= 22 || startHour < 6

  const startDay = startUtc.getUTCDay() // 0=Sun, 6=Sat
  const isWeekend = startDay === 0 || startDay === 6

  if (isSleepIn) {
    return { weekday: 0, weekend: 0, bank_holiday: 0, night: 0, sleep_in: 1, disturbed: 0 }
  }
  if (isBankHoliday) {
    return { weekday: 0, weekend: 0, bank_holiday: workedMins, night: 0, sleep_in: 0, disturbed: 0 }
  }
  if (isNight) {
    return { weekday: 0, weekend: 0, bank_holiday: 0, night: workedMins, sleep_in: 0, disturbed: 0 }
  }
  if (isWeekend) {
    return { weekday: 0, weekend: workedMins, bank_holiday: 0, night: 0, sleep_in: 0, disturbed: 0 }
  }
  return { weekday: workedMins, weekend: 0, bank_holiday: 0, night: 0, sleep_in: 0, disturbed: 0 }
}

export function reconcileShift(opts: {
  shift: PlannedShift
  clockings: ClockingEvent[]
  isBankHoliday: boolean
  noShowGraceMinutes?: number
  noClockOutHoldMinutes?: number
  nowUtc?: Date
}): ReconciliationResult {
  const {
    shift, clockings, isBankHoliday,
    noShowGraceMinutes = 30,
    noClockOutHoldMinutes = 90,
    nowUtc = new Date(),
  } = opts

  const plannedStart = new Date(shift.planned_start_utc)
  const plannedEnd   = new Date(shift.planned_end_utc)
  const noShowBy     = new Date(plannedStart.getTime() + noShowGraceMinutes * 60_000)
  const holdBy       = new Date(plannedEnd.getTime() + noClockOutHoldMinutes * 60_000)

  const disturbed    = sumDisturbedMinutes(clockings)
  const pairs        = pairClockings(clockings)

  // No events at all
  if (pairs.length === 0) {
    if (nowUtc < noShowBy) {
      // Too early to judge
      return {
        reconciliation_state: 'pending',
        actual_start_utc: null, actual_end_utc: null,
        actual_worked_minutes: null, actual_break_minutes: 0,
        disturbed_minutes: 0, clockings_count: 0,
        payable: null, source_rule: 'auto_actual',
      }
    }
    // No-show
    return {
      reconciliation_state: 'no_show',
      actual_start_utc: null, actual_end_utc: null,
      actual_worked_minutes: 0, actual_break_minutes: 0,
      disturbed_minutes: 0, clockings_count: 0,
      payable: { weekday: 0, weekend: 0, bank_holiday: 0, night: 0, sleep_in: 0, disturbed: 0 },
      source_rule: 'pay_zero_no_show',
    }
  }

  const firstIn  = pairs[0]!.inTime
  const lastPair = pairs[pairs.length - 1]!

  // Clock-in present but no clock-out on last pair
  if (lastPair.outTime === null) {
    if (nowUtc < holdBy) {
      return {
        reconciliation_state: 'pending',
        actual_start_utc: firstIn.toISOString(),
        actual_end_utc: null, actual_worked_minutes: null,
        actual_break_minutes: 0, disturbed_minutes: disturbed,
        clockings_count: pairs.length, payable: null, source_rule: 'auto_actual',
      }
    }
    return {
      reconciliation_state: 'no_clock_out',
      actual_start_utc: firstIn.toISOString(),
      actual_end_utc: null, actual_worked_minutes: null,
      actual_break_minutes: 0, disturbed_minutes: disturbed,
      clockings_count: pairs.length,
      payable: null,         // held until manager resolves
      source_rule: 'auto_actual',
    }
  }

  const lastOut       = lastPair.outTime
  const startDelta    = Math.abs(firstIn.getTime() - plannedStart.getTime())
  const endDelta      = Math.abs(lastOut.getTime() - plannedEnd.getTime())
  const workedMs      = lastOut.getTime() - firstIn.getTime()
  const plannedMs     = plannedEnd.getTime() - plannedStart.getTime()
  const plannedBreak  = shift.planned_break_minutes
  const workedMins    = Math.max(0, Math.round(workedMs / 60_000) - plannedBreak)

  let state: ReconciliationResult['reconciliation_state']
  if (startDelta <= MATCH_WINDOW_MS && endDelta <= MATCH_WINDOW_MS) {
    state = 'matched'
  } else if (workedMs > plannedMs + MATCH_WINDOW_MS) {
    state = 'over_planned'
  } else {
    state = 'under_planned'
  }

  const payable = classifyMinutes(
    firstIn, lastOut, isBankHoliday, shift.is_sleep_in, plannedBreak,
  )
  payable.disturbed = disturbed

  return {
    reconciliation_state: state,
    actual_start_utc: firstIn.toISOString(),
    actual_end_utc: lastOut.toISOString(),
    actual_worked_minutes: workedMins,
    actual_break_minutes: plannedBreak,
    disturbed_minutes: disturbed,
    clockings_count: pairs.length,
    payable,
    source_rule: 'auto_actual',
  }
}
