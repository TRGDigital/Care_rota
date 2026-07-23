import type { SupabaseClient } from '@supabase/supabase-js'
import { createRotaPeriod } from './period-create'
import { autoFillPeriod } from './auto-fill'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export type GenerateHorizonResult = {
  periodsCreated: number
  periodsAutoFilled: number
  shiftsAssigned: number
  shiftsPreFilled: number
  openShifts: number
  errors: string[]
}

/**
 * How many consecutive rota periods are needed to cover `weeksAhead` weeks, given each
 * period spans `periodWeeks` weeks. Pure and rounded up so the horizon is fully covered.
 */
export function periodsToCover(weeksAhead: number, periodWeeks: number): number {
  if (!Number.isFinite(weeksAhead) || weeksAhead <= 0) return 0
  if (!Number.isFinite(periodWeeks) || periodWeeks <= 0) return 0
  return Math.ceil(weeksAhead / periodWeeks)
}

/**
 * Generate the rota for the next `weeksAhead` weeks (default 26 ≈ 6 months). Each iteration
 * creates the next period from the standard-week template (pre-filling fixed shifts), then
 * auto-fills the remaining open shifts. createRotaPeriod chains from the last existing period,
 * so this is safe to re-run to extend the horizon further rather than duplicating.
 *
 * Requires a standard-week template (rota_slot_requirements) to be configured for the home;
 * with none, periods are created empty and nothing is assigned.
 */
export async function generateHorizon(
  supabase: AnyClient,
  homeId: string,
  userId: string,
  opts?: { weeksAhead?: number },
): Promise<GenerateHorizonResult> {
  const weeksAhead = opts?.weeksAhead ?? 26

  const { data: home } = await supabase
    .from('homes')
    .select('rota_period_weeks')
    .eq('id', homeId)
    .maybeSingle()
  const periodWeeks: number = home?.rota_period_weeks ?? 1

  const count = periodsToCover(weeksAhead, periodWeeks)

  const result: GenerateHorizonResult = {
    periodsCreated: 0, periodsAutoFilled: 0, shiftsAssigned: 0, shiftsPreFilled: 0, openShifts: 0, errors: [],
  }

  for (let i = 0; i < count; i++) {
    const created = await createRotaPeriod(supabase, homeId, userId)
    if (!created.success) {
      result.errors.push(`Period ${i + 1}: ${created.error}`)
      break // periods chain, so a failure means we can't create later ones either
    }
    result.periodsCreated++
    result.shiftsPreFilled += created.shiftsPreFilled

    const filled = await autoFillPeriod(supabase, homeId, created.periodId, userId)
    if (filled.success) {
      result.periodsAutoFilled++
      result.shiftsAssigned += filled.assigned
      result.openShifts += filled.open
    } else {
      result.errors.push(`Auto-fill ${i + 1}: ${filled.error}`)
    }
  }

  return result
}
