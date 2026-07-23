import { describe, it, expect } from 'vitest'
import { periodsToCover } from '../generate-horizon'

describe('periodsToCover', () => {
  it('covers 26 weeks with 1-week periods → 26 periods', () => {
    expect(periodsToCover(26, 1)).toBe(26)
  })
  it('covers 26 weeks with 4-week periods → 7 (rounded up)', () => {
    expect(periodsToCover(26, 4)).toBe(7)
  })
  it('covers 26 weeks with 2-week periods → 13', () => {
    expect(periodsToCover(26, 2)).toBe(13)
  })
  it('rounds partial coverage up', () => {
    expect(periodsToCover(10, 3)).toBe(4) // 3+3+3+1
  })
  it('is zero for non-positive inputs', () => {
    expect(periodsToCover(0, 1)).toBe(0)
    expect(periodsToCover(26, 0)).toBe(0)
    expect(periodsToCover(-5, 1)).toBe(0)
    expect(periodsToCover(Number.NaN, 1)).toBe(0)
  })
})
