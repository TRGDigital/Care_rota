// Occupancy-aware cost guard — runs every 4 hours via Supabase Cron.
// For each home, compares current occupancy + dependency against the
// staffing matrix. If overstaffed, raises a rebalance_suggestions row.
// Trigger: supabase.functions.invoke('occupancy-cost-guard') or schedule.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const DEFAULT_HOURLY_PENCE = 1200

Deno.serve(async () => {
  const now = new Date()

  // Fetch all active homes
  const { data: homes, error: homesErr } = await supabase
    .from('homes')
    .select('id, organisation_id, tenant_id, bed_capacity')

  if (homesErr) {
    return new Response(JSON.stringify({ error: homesErr.message }), { status: 500 })
  }

  let suggestionsCreated = 0
  let errors = 0

  for (const home of homes ?? []) {
    try {
      await processHome(home.id, home.organisation_id, now)
      suggestionsCreated++
    } catch (err) {
      console.error('cost-guard error', { homeId: home.id, err })
      errors++
    }
  }

  return new Response(
    JSON.stringify({ suggestionsCreated, errors, processedAt: now.toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})

async function processHome(homeId: string, tenantId: string, now: Date): Promise<void> {
  // 1. Latest occupancy snapshot
  const { data: snapshot } = await supabase
    .from('bed_occupancy_snapshots')
    .select('occupied_beds, snapshot_at')
    .eq('home_id', homeId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!snapshot) return

  // 2. Current dependency totals — latest assessment per resident
  const { data: assessments } = await supabase
    .from('dependency_assessments')
    .select('resident_id, overall_band, assessment_date')
    .eq('home_id', homeId)
    .not('resident_id', 'is', null)
    .order('assessment_date', { ascending: false })

  const totals = computeDependencyTotals(assessments ?? [])

  // 3. Staffing matrix
  const { data: matrices } = await supabase
    .from('staffing_matrices')
    .select('*')
    .eq('home_id', homeId)

  if (!matrices?.length) return

  // 4. Upcoming shifts — next 14 days, unassigned or assigned
  const fromDate = now.toISOString().slice(0, 10)
  const toDate = new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10)

  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, staff_id, planned_start_utc, planned_end_utc, planned_paid_hours')
    .eq('home_id', homeId)
    .gte('planned_start_utc', fromDate)
    .lte('planned_start_utc', toDate)
    .in('state', ['unassigned', 'assigned'])

  if (!shifts?.length) return

  // 5. Compute proposed cuts
  const proposedCuts = computeProposedCuts(shifts, matrices, totals, snapshot.occupied_beds)
  if (!proposedCuts.length) return

  // Check if an open suggestion already exists for this home
  const { count: existingOpen } = await supabase
    .from('rebalance_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .eq('trigger_type', 'occupancy_drop')
    .eq('status', 'open')

  if ((existingOpen ?? 0) > 0) return // don't flood with duplicates

  const totalSavingsPence = proposedCuts.reduce((sum, c) => sum + c.savingsPence, 0)
  const shiftIds = proposedCuts.map(c => c.shiftId)

  const summary =
    `Bed occupancy at ${snapshot.occupied_beds}. ` +
    `Staffing matrix suggests ${proposedCuts.length} shift${proposedCuts.length !== 1 ? 's' : ''} ` +
    `can be removed. Estimated saving: £${(totalSavingsPence / 100).toFixed(2)}.`

  const proposedChanges = proposedCuts.map(c => ({
    shift_id: c.shiftId,
    action: 'remove',
    staff_id: c.staffId ?? null,
    reason: c.reason,
    saving_pence: c.savingsPence,
    shift_date: c.shiftDate,
    shift_block: c.shiftBlock,
  }))

  const { error: insertErr } = await supabase.from('rebalance_suggestions').insert({
    tenant_id: tenantId,
    home_id: homeId,
    trigger_type: 'occupancy_drop',
    status: 'open',
    summary,
    shift_ids_affected: shiftIds,
    proposed_changes: proposedChanges,
    cost_impact_pence: -totalSavingsPence, // negative = saving
    created_by_user_id: null,
  })

  if (insertErr) throw insertErr

  await supabase.from('audit_events').insert({
    home_id: homeId,
    tenant_id: tenantId,
    actor_user_id: null,
    action_code: 'cost_guard_suggestion_raised',
    entity_type: 'rebalance_suggestion',
    entity_id: null,
    metadata: { occupiedBeds: snapshot.occupied_beds, proposedCuts: proposedCuts.length, savingsPence: totalSavingsPence },
  })
}

type Assessment = { resident_id: string | null; overall_band: string; assessment_date: string }
type DependencyTotals = { low: number; medium: number; high: number; one_to_one: number }

function computeDependencyTotals(assessments: Assessment[]): DependencyTotals {
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

type Shift = {
  id: string
  staff_id: string | null
  planned_start_utc: string
  planned_end_utc: string
  planned_paid_hours: number
}
type Matrix = {
  shift_block: string
  min_carers: number
  min_senior_carers: number
  min_nurses: number
  min_ancillary: number
}
type ProposedCut = {
  shiftId: string
  staffId: string | null
  shiftDate: string
  shiftBlock: string
  savingsPence: number
  reason: 'overtime' | 'above_matrix_minimum'
}

function computeProposedCuts(
  shifts: Shift[],
  matrices: Matrix[],
  _totals: DependencyTotals,
  _occupiedBeds: number,
): ProposedCut[] {
  const byBlock = new Map<string, Shift[]>()
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

  for (const [key, group] of byBlock) {
    const [date, block] = key.split('|') as [string, string]
    const matrix = matrices.find(m => m.shift_block === block) ?? matrices[0]
    if (!matrix) continue

    const minRequired = matrix.min_carers + matrix.min_senior_carers + matrix.min_nurses + matrix.min_ancillary
    if (group.length <= minRequired) continue

    const excess = group.slice(minRequired)
    for (const s of excess) {
      cuts.push({
        shiftId: s.id,
        staffId: s.staff_id,
        shiftDate: date,
        shiftBlock: block,
        savingsPence: Math.round(DEFAULT_HOURLY_PENCE * s.planned_paid_hours),
        reason: 'above_matrix_minimum',
      })
    }
  }

  return cuts
}
