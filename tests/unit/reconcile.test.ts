import { describe, it, expect } from 'vitest'
import { reconcileShift } from '@carerota/domain'
import type { ClockingEvent, PlannedShift } from '@carerota/domain'

// Helpers
function shift(overrides: Partial<PlannedShift> = {}): PlannedShift {
  return {
    id: 's1',
    staff_id: 'staff1',
    planned_start_utc: '2026-05-13T07:00:00Z',
    planned_end_utc:   '2026-05-13T19:00:00Z',
    planned_break_minutes: 60,
    is_sleep_in: false,
    ...overrides,
  }
}

function clockIn(offsetMins: number): ClockingEvent {
  const base = new Date('2026-05-13T07:00:00Z')
  base.setMinutes(base.getMinutes() + offsetMins)
  return { id: `in-${offsetMins}`, event_type: 'clock_in', event_time_utc: base.toISOString() }
}

function clockOut(offsetMins: number): ClockingEvent {
  const base = new Date('2026-05-13T19:00:00Z')
  base.setMinutes(base.getMinutes() + offsetMins)
  return { id: `out-${offsetMins}`, event_type: 'clock_out', event_time_utc: base.toISOString() }
}

function disturbed(startOffsetMins: number, endOffsetMins: number): ClockingEvent[] {
  const base = new Date('2026-05-13T07:00:00Z')
  const s = new Date(base); s.setMinutes(s.getMinutes() + startOffsetMins)
  const e = new Date(base); e.setMinutes(e.getMinutes() + endOffsetMins)
  return [
    { id: `ds-${startOffsetMins}`, event_type: 'disturbed_start', event_time_utc: s.toISOString() },
    { id: `de-${endOffsetMins}`,   event_type: 'disturbed_end',   event_time_utc: e.toISOString() },
  ]
}

describe('reconcileShift — acceptance tests (§11.3)', () => {
  describe('pending', () => {
    it('returns pending when no events and within grace window', () => {
      const result = reconcileShift({
        shift: shift(),
        clockings: [],
        isBankHoliday: false,
        nowUtc: new Date('2026-05-13T07:10:00Z'), // within 30-min grace
      })
      expect(result.reconciliation_state).toBe('pending')
      expect(result.payable).toBeNull()
    })

    it('returns pending when clocked in but no clock-out within hold window', () => {
      const result = reconcileShift({
        shift: shift(),
        clockings: [clockIn(2)],
        isBankHoliday: false,
        nowUtc: new Date('2026-05-13T19:30:00Z'), // 30 min after end, within 90-min hold
      })
      expect(result.reconciliation_state).toBe('pending')
      expect(result.payable).toBeNull()
    })
  })

  describe('matched (acceptance test 7)', () => {
    it('clocked in -2 min, out +15 min → matched; pays actual weekday minutes', () => {
      // Planned 07:00–19:00, clocked 06:58–19:15
      const result = reconcileShift({
        shift: shift(),
        clockings: [clockIn(-2), clockOut(15)],
        isBankHoliday: false,
        nowUtc: new Date('2026-05-13T20:00:00Z'),
      })
      expect(result.reconciliation_state).toBe('matched')
      expect(result.actual_start_utc).toBe('2026-05-13T06:58:00.000Z')
      expect(result.actual_end_utc).toBe('2026-05-13T19:15:00.000Z')
      // worked = 737 min − 60 min break = 677 min
      expect(result.actual_worked_minutes).toBe(677)
      expect(result.payable?.weekday).toBe(677)
      expect(result.payable?.weekend).toBe(0)
    })
  })

  describe('under_planned (acceptance test 8)', () => {
    it('clocked in +5 min, out -30 min → under_planned', () => {
      // Planned 07:00–19:00, clocked 07:05–18:30
      const result = reconcileShift({
        shift: shift(),
        clockings: [clockIn(5), clockOut(-30)],
        isBankHoliday: false,
        nowUtc: new Date('2026-05-13T20:00:00Z'),
      })
      expect(result.reconciliation_state).toBe('under_planned')
      expect(result.payable?.weekday).toBeGreaterThan(0)
    })
  })

  describe('over_planned', () => {
    it('worked >15 min longer than planned → over_planned', () => {
      const result = reconcileShift({
        shift: shift(),
        clockings: [clockIn(0), clockOut(30)],
        isBankHoliday: false,
        nowUtc: new Date('2026-05-13T21:00:00Z'),
      })
      expect(result.reconciliation_state).toBe('over_planned')
    })
  })

  describe('no_show (acceptance test 9)', () => {
    it('no events, grace window passed → no_show; all payable minutes = 0', () => {
      const result = reconcileShift({
        shift: shift(),
        clockings: [],
        isBankHoliday: false,
        noShowGraceMinutes: 30,
        nowUtc: new Date('2026-05-13T07:31:00Z'), // just past grace
      })
      expect(result.reconciliation_state).toBe('no_show')
      expect(result.payable?.weekday).toBe(0)
      expect(result.payable?.weekend).toBe(0)
      expect(result.payable?.bank_holiday).toBe(0)
      expect(result.payable?.sleep_in).toBe(0)
      expect(result.payable?.disturbed).toBe(0)
      expect(result.source_rule).toBe('pay_zero_no_show')
    })
  })

  describe('no_clock_out (acceptance test 10)', () => {
    it('clocked in, no clock-out, hold window passed → no_clock_out; payable = null', () => {
      const result = reconcileShift({
        shift: shift(),
        clockings: [clockIn(2)],
        isBankHoliday: false,
        noClockOutHoldMinutes: 90,
        nowUtc: new Date('2026-05-13T20:32:00Z'), // 92 min after planned end
      })
      expect(result.reconciliation_state).toBe('no_clock_out')
      expect(result.payable).toBeNull()
    })
  })

  describe('sleep-in (acceptance test 11)', () => {
    it('sleep-in shift → payable.sleep_in = 1, weekday = 0', () => {
      const result = reconcileShift({
        shift: shift({ is_sleep_in: true }),
        clockings: [clockIn(0), clockOut(0)],
        isBankHoliday: false,
        nowUtc: new Date('2026-05-13T20:00:00Z'),
      })
      expect(result.payable?.sleep_in).toBe(1)
      expect(result.payable?.weekday).toBe(0)
    })

    it('sleep-in with two 30-min disturbed periods → disturbed = 60', () => {
      const clockings: ClockingEvent[] = [
        clockIn(0),
        ...disturbed(120, 150),  // 30 min disturbed (from 09:00 to 09:30)
        ...disturbed(240, 270),  // 30 min disturbed (from 11:00 to 11:30)
        clockOut(0),
      ]
      const result = reconcileShift({
        shift: shift({ is_sleep_in: true }),
        clockings,
        isBankHoliday: false,
        nowUtc: new Date('2026-05-13T20:00:00Z'),
      })
      expect(result.payable?.sleep_in).toBe(1)
      expect(result.disturbed_minutes).toBe(60)
      expect(result.payable?.disturbed).toBe(60)
    })
  })

  describe('bank holiday', () => {
    it('bank holiday shift → all payable minutes in bank_holiday bucket', () => {
      const result = reconcileShift({
        shift: shift(),
        clockings: [clockIn(0), clockOut(0)],
        isBankHoliday: true,
        nowUtc: new Date('2026-05-13T20:00:00Z'),
      })
      expect(result.payable?.bank_holiday).toBeGreaterThan(0)
      expect(result.payable?.weekday).toBe(0)
    })
  })

  describe('weekend shift', () => {
    it('weekend shift → all payable minutes in weekend bucket', () => {
      const saturdayShift = shift({
        planned_start_utc: '2026-05-16T07:00:00Z', // Saturday
        planned_end_utc:   '2026-05-16T19:00:00Z',
      })
      const satIn: ClockingEvent  = { id: 'i', event_type: 'clock_in',  event_time_utc: '2026-05-16T07:00:00Z' }
      const satOut: ClockingEvent = { id: 'o', event_type: 'clock_out', event_time_utc: '2026-05-16T19:00:00Z' }
      const result = reconcileShift({
        shift: saturdayShift,
        clockings: [satIn, satOut],
        isBankHoliday: false,
        nowUtc: new Date('2026-05-16T20:00:00Z'),
      })
      expect(result.payable?.weekend).toBeGreaterThan(0)
      expect(result.payable?.weekday).toBe(0)
    })
  })
})
