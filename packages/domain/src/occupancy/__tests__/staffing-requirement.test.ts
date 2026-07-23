import { describe, it, expect } from 'vitest'
import { requiredHeadcount, cuttableCount, matrixFloorTotal } from '../staffing-requirement'

describe('matrixFloorTotal', () => {
  it('sums the role minimums', () => {
    expect(matrixFloorTotal({ min_carers: 3, min_senior_carers: 1, min_nurses: 1, min_ancillary: 0 })).toBe(5)
  })
})

describe('requiredHeadcount — occupancy-scaled with a floor', () => {
  // baseline planned = 7 at full occupancy, capacity 40, floor 4
  it('at full occupancy keeps the whole baseline', () => {
    expect(requiredHeadcount(7, 40, 40, 4)).toBe(7)
  })
  it('trims proportionally as occupancy drops (36/40 → ceil(6.3)=7? no, 7*0.9=6.3→7)', () => {
    // 36/40 = 0.9 → 7*0.9 = 6.3 → ceil = 7 (rounding up keeps it safe)
    expect(requiredHeadcount(7, 36, 40, 4)).toBe(7)
  })
  it('trims to 6 when the scaled value lands at or below 6', () => {
    // 34/40 = 0.85 → 7*0.85 = 5.95 → ceil = 6
    expect(requiredHeadcount(7, 34, 40, 4)).toBe(6)
  })
  it('never drops below the matrix floor even at low occupancy', () => {
    // 10/40 = 0.25 → 7*0.25 = 1.75 → ceil = 2, but floor is 4
    expect(requiredHeadcount(7, 10, 40, 4)).toBe(4)
  })
  it('clamps occupancy above capacity to full (no negative trim / over-scale)', () => {
    expect(requiredHeadcount(7, 45, 40, 4)).toBe(7)
  })
  it('falls back to the baseline when capacity is zero or missing', () => {
    expect(requiredHeadcount(7, 30, 0, 4)).toBe(7)
    expect(requiredHeadcount(7, 30, Number.NaN, 4)).toBe(7)
  })
  it('respects the floor when the baseline itself is below the floor', () => {
    expect(requiredHeadcount(2, 40, 40, 4)).toBe(4)
  })
})

describe('cuttableCount', () => {
  it('is zero at full occupancy', () => {
    expect(cuttableCount(7, 40, 40, 4)).toBe(0)
  })
  it('is the excess over the scaled requirement', () => {
    // required at 34/40 = 6, planned 7 → 1 cuttable
    expect(cuttableCount(7, 34, 40, 4)).toBe(1)
  })
  it('never proposes cutting below the floor', () => {
    // required floored at 4, planned 7 → at most 3 cuttable
    expect(cuttableCount(7, 10, 40, 4)).toBe(3)
  })
  it('is never negative when already understaffed', () => {
    expect(cuttableCount(3, 40, 40, 4)).toBe(0)
  })
})
