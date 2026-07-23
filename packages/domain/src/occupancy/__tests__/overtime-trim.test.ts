import { describe, it, expect } from 'vitest'
import { planOvertimeTrims, type StaffWeekOvertime } from '../overtime-trim'

const base = (over: Partial<StaffWeekOvertime>): StaffWeekOvertime => ({
  staffId: 's1', staffName: 'Staff One', weekKey: '2026-W29',
  lastShiftId: 'shift-1', lastShiftHours: 12, overtimeHours: 8,
  overtimeWeighting: 50, overtimeRatePence: 1923, eligible: true, ...over,
})

describe('planOvertimeTrims', () => {
  it('trims nothing at full occupancy', () => {
    expect(planOvertimeTrims([base({})], 1)).toEqual([])
  })

  it('sheds overtime proportional to the occupancy drop', () => {
    // one staff, 8h overtime, 50% occupancy → shed 8*0.5 = 4h from their last shift (12h → 8h)
    const trims = planOvertimeTrims([base({})], 0.5)
    expect(trims).toHaveLength(1)
    expect(trims[0].reduceHoursBy).toBe(4)
    expect(trims[0].newHours).toBe(8)
    expect(trims[0].savingsPence).toBe(BigInt(Math.round(4 * 1923)))
  })

  it('a 10% occupancy drop sheds ~10% of the overtime', () => {
    const trims = planOvertimeTrims([base({ overtimeHours: 10, lastShiftHours: 12 })], 0.9)
    expect(trims[0].reduceHoursBy).toBe(1) // 10 * 0.1
  })

  it('sheds from the lowest overtime weighting first (best workers keep overtime)', () => {
    // Two staff, 8h overtime each in the same week → total 16, 75% occupancy → shed 16*0.25 = 4h.
    // Should come entirely from the lower-weighted worker first.
    const trims = planOvertimeTrims([
      base({ staffId: 'low', staffName: 'Low', lastShiftId: 'l', overtimeWeighting: 10 }),
      base({ staffId: 'high', staffName: 'High', lastShiftId: 'h', overtimeWeighting: 90 }),
    ], 0.75)
    expect(trims).toHaveLength(1)
    expect(trims[0].staffId).toBe('low')
    expect(trims[0].reduceHoursBy).toBe(4)
  })

  it('spills to the next-lowest weighting when the first is exhausted', () => {
    // total overtime 16, shed 12 (25%*... use ratio 0.25 → shed 16*0.75 = 12).
    // low has 8h max trimmable → 8, remaining 4 from high.
    const trims = planOvertimeTrims([
      base({ staffId: 'low', overtimeWeighting: 10 }),
      base({ staffId: 'high', overtimeWeighting: 90 }),
    ], 0.25)
    expect(trims).toHaveLength(2)
    const low = trims.find((t) => t.staffId === 'low')!
    const high = trims.find((t) => t.staffId === 'high')!
    expect(low.reduceHoursBy).toBe(8)
    expect(high.reduceHoursBy).toBe(4)
  })

  it('never shaves more than the overtime (keeps contracted hours intact)', () => {
    // 8h overtime on a 12h shift; even at 0% occupancy only 8h is trimmable, not the whole 12h.
    const trims = planOvertimeTrims([base({ overtimeHours: 8, lastShiftHours: 12 })], 0)
    expect(trims[0].reduceHoursBy).toBe(8)
    expect(trims[0].newHours).toBe(4) // the 4h of contracted work on that day remains
  })

  it('never shaves more than the last shift is long', () => {
    // overtime 10h but the last shift is only 6h → can only trim 6 from it
    const trims = planOvertimeTrims([base({ overtimeHours: 10, lastShiftHours: 6 })], 0)
    expect(trims[0].reduceHoursBy).toBe(6)
    expect(trims[0].newHours).toBe(0)
  })

  it('sheds discretionary (non-eligible) overtime before eligible staff, even at higher weighting', () => {
    // Ancillary worker (not eligible, high weighting) vs an eligible carer (low weighting).
    // total 16h OT, shed 4h → should come from the non-eligible ancillary first despite weighting.
    const trims = planOvertimeTrims([
      base({ staffId: 'laundry', overtimeWeighting: 90, eligible: false }),
      base({ staffId: 'carer', overtimeWeighting: 10, eligible: true }),
    ], 0.75)
    expect(trims).toHaveLength(1)
    expect(trims[0].staffId).toBe('laundry')
  })

  it('keeps weeks independent', () => {
    const trims = planOvertimeTrims([
      base({ weekKey: '2026-W29', lastShiftId: 'a' }),
      base({ weekKey: '2026-W30', lastShiftId: 'b' }),
    ], 0.5)
    expect(trims).toHaveLength(2)
    expect(trims.every((t) => t.reduceHoursBy === 4)).toBe(true)
  })
})
