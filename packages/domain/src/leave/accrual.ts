// 12.07% accrual is derived from 5.6 weeks / 46.4 working weeks = 0.1207
export const ACCRUAL_RATE_12_07 = 0.1207

export type HolidayAccrualModel = 'fixed' | '12_07_pct' | 'enhanced'

/**
 * Compute hours of leave accrued for a pay period.
 * - fixed: entitlement is static (set on staff creation), so accrual = 0
 * - 12_07_pct: irregular/zero-hours workers — 12.07% of hours worked
 * - enhanced: employer tops up above statutory, treated same as 12_07_pct
 *   with the rate configured per-home (falls back to 12.07% here)
 */
export function computeLeaveAccrual(
  hoursWorked: number,
  model: HolidayAccrualModel,
  customRate?: number
): number {
  if (model === 'fixed') return 0
  const rate = customRate ?? ACCRUAL_RATE_12_07
  return Math.round(hoursWorked * rate * 100) / 100 // 2dp
}
