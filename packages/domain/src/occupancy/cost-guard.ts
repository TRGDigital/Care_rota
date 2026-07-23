import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@carerota/types'

export type RebalanceSuggestion = {
  homeId: string
  proposedCuts: ProposedCut[]
  totalSavingsPence: bigint
  occupiedBeds: number
  generatedAt: Date
}

export type ProposedCut = {
  shiftId: string
  staffName: string
  shiftDate: string
  shiftBlock: string
  savingsPence: bigint
  reason: 'overtime' | 'above_matrix_minimum'
}

type DependencyTotals = {
  low: number
  medium: number
  high: number
  one_to_one: number
}

/**
 * Source-agnostic cost guard.
 * Reads bed_occupancy_snapshots and dependency_assessments without
 * caring whether those rows came from manual entry, CSV import, or
 * CareStream API sync.
 */
export async function runCostGuard(
  supabase: SupabaseClient<Database>,
  homeId: string,
): Promise<RebalanceSuggestion | null> {
  // 1. Latest occupancy snapshot
  const { data: snapshot } = await supabase
    .from('bed_occupancy_snapshots')
    .select('occupied_beds, snapshot_at')
    .eq('home_id', homeId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!snapshot) return null

  // 2. Current dependency totals (active residents only, latest assessment per resident)
  const { data: assessments } = await supabase
    .from('dependency_assessments')
    .select('resident_id, overall_band, assessment_date')
    .eq('home_id', homeId)
    .not('resident_id', 'is', null)
    .order('assessment_date', { ascending: false })

  const totals = computeDependencyTotals(assessments ?? [])

  // 3. Staffing matrix for next 14 days
  const { data: matrices } = await supabase
    .from('staffing_matrices')
    .select('*')
    .eq('home_id', homeId)

  if (!matrices?.length) return null

  // 4. Upcoming shifts (next 14 days)
  const from = new Date().toISOString().slice(0, 10)
  const to = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)

  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, planned_start_utc, planned_end_utc, planned_paid_hours')
    .eq('home_id', homeId)
    .gte('planned_start_utc', from)
    .lte('planned_start_utc', to)
    .in('state', ['unassigned', 'assigned'])

  if (!shifts?.length) return null

  // 5. Group shifts by date+block and find proposed cuts
  const proposedCuts = computeProposedCuts(shifts ?? [], matrices, totals, snapshot.occupied_beds)

  if (!proposedCuts.length) return null

  const totalSavingsPence = proposedCuts.reduce((sum, c) => sum + c.savingsPence, 0n)

  return {
    homeId,
    proposedCuts,
    totalSavingsPence,
    occupiedBeds: snapshot.occupied_beds,
    generatedAt: new Date(),
  }
}

function computeDependencyTotals(
  assessments: { resident_id: string | null; overall_band: string; assessment_date: string }[],
): DependencyTotals {
  // Latest assessment per resident
  const latestByResident = new Map<string, string>()
  for (const a of assessments) {
    if (!a.resident_id) continue
    if (!latestByResident.has(a.resident_id)) {
      latestByResident.set(a.resident_id, a.overall_band)
    }
  }

  const totals: DependencyTotals = { low: 0, medium: 0, high: 0, one_to_one: 0 }
  for (const band of latestByResident.values()) {
    if (band in totals) totals[band as keyof DependencyTotals]++
  }
  return totals
}

function computeProposedCuts(
  shifts: { id: string; planned_start_utc: string; planned_end_utc: string; planned_paid_hours: number }[],
  matrices: { shift_block: string; min_carers: number; min_senior_carers: number; min_nurses: number; min_ancillary: number }[],
  _totals: DependencyTotals,
  _occupiedBeds: number,
): ProposedCut[] {
  // Group by date + shift_block
  const byBlock = new Map<string, typeof shifts>()
  for (const s of shifts) {
    const date = s.planned_start_utc.slice(0, 10)
    const hour = new Date(s.planned_start_utc).getUTCHours()
    const block = hour < 8 ? 'night' : hour < 14 ? 'morning' : hour < 20 ? 'afternoon' : 'long_day'
    const key = `${date}|${block}`
    const group = byBlock.get(key) ?? []
    group.push(s)
    byBlock.set(key, group)
  }

  const cuts: ProposedCut[] = []
  const DEFAULT_HOURLY_PENCE = 1200

  for (const [key, group] of byBlock) {
    const [date, block] = key.split('|') as [string, string]
    const matrix = matrices.find(m => m.shift_block === block) ?? matrices[0]
    if (!matrix) continue

    const totalInBlock = group.length
    const minRequired = matrix.min_carers + matrix.min_senior_carers + matrix.min_nurses + matrix.min_ancillary

    if (totalInBlock > minRequired) {
      const excess = group.slice(minRequired)

      for (const s of excess) {
        const hours = s.planned_paid_hours
        const saving = BigInt(Math.round(DEFAULT_HOURLY_PENCE * hours))

        cuts.push({
          shiftId:       s.id,
          staffName:     'Staff member',
          shiftDate:     date,
          shiftBlock:    block,
          savingsPence:  saving,
          reason:        'above_matrix_minimum',
        })
      }
    }
  }

  return cuts
}
