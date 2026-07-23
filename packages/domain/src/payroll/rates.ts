import type { StaffPayRate, ReferenceWageRate } from './types'

export function resolveRate(rates: StaffPayRate[], staffId: string, shiftDate: string): StaffPayRate | null {
  const d = shiftDate.slice(0, 10)
  const matches = rates
    .filter(r =>
      r.staff_id === staffId &&
      r.effective_from.slice(0, 10) <= d &&
      (r.effective_to === null || r.effective_to.slice(0, 10) >= d)
    )
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  return matches[0] ?? null
}

export function resolveNmwFloor(
  rates: ReferenceWageRate[],
  dateOfBirth: string | null,
  periodEndDate: string
): number {
  if (!dateOfBirth) return 0
  const ageAtPeriodEnd = ageOnDate(dateOfBirth, periodEndDate)
  const ageBand = nmwAgeBand(ageAtPeriodEnd)

  const d = periodEndDate.slice(0, 10)
  const match = rates
    .filter(r =>
      r.age_band === ageBand &&
      r.effective_from.slice(0, 10) <= d &&
      (r.effective_to === null || r.effective_to.slice(0, 10) >= d)
    )
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]

  return match?.rate_pence ?? 0
}

function ageOnDate(dob: string, date: string): number {
  const d = new Date(date)
  const b = new Date(dob)
  let age = d.getFullYear() - b.getFullYear()
  const m = d.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--
  return age
}

function nmwAgeBand(age: number): string {
  if (age >= 21) return 'nlw_21_plus'
  if (age >= 18) return 'nmw_18_20'
  if (age >= 16) return 'nmw_16_17'
  return 'nmw_apprentice'
}

// Half-up rounding to nearest pence (HMRC convention)
export function roundHalfUp(n: number): bigint {
  return BigInt(Math.round(n))
}

export function minutesToPence(minutes: number, ratePencePerHour: number, multiplier: number): bigint {
  return roundHalfUp((minutes / 60) * ratePencePerHour * multiplier)
}
