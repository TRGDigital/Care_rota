import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@carerota/types'
import { requiredHeadcount, matrixFloorTotal, type StaffingFloor } from './staffing-requirement'

export type RebalanceSuggestion = {
  homeId: string
  proposedCuts: ProposedCut[]
  totalSavingsPence: bigint
  occupiedBeds: number
  capacity: number
  generatedAt: Date
}

export type ProposedCut = {
  shiftId: string
  staffId: string | null
  staffName: string
  shiftDate: string
  shiftBlock: string
  hours: number
  isOvertime: boolean
  savingsPence: bigint
  reason: 'overtime' | 'above_matrix_minimum'
}

// ── Row shapes we read (kept local so joins stay explicit) ──────────────────────
type ShiftRow = {
  id: string
  staff_id: string | null
  planned_start_utc: string
  planned_paid_hours: number | string
  role_code: string | null
}
type StaffRow = { id: string; first_name: string; last_name: string; overtime_weighting: number | null }
type ContractRow = { staff_id: string; contracted_hours_per_week: number | string; effective_from: string; effective_to: string | null }
type PayRateRow = {
  staff_id: string
  rate_weekday_pence: number | string | null
  rate_weekend_pence: number | string | null
  rate_overtime_pence: number | string | null
  effective_from: string
  effective_to: string | null
}

const DEFAULT_HOURLY_PENCE = 1200

// Map a shift's UTC start hour to a matrix shift_block name.
function blockFor(startUtc: string): 'night' | 'morning' | 'afternoon' | 'long_day' {
  const hour = new Date(startUtc).getUTCHours()
  return hour < 8 ? 'night' : hour < 14 ? 'morning' : hour < 20 ? 'afternoon' : 'long_day'
}

function isNurseRole(roleCode: string | null): boolean {
  const lc = (roleCode ?? '').toLowerCase()
  return lc.includes('nurse') || lc === 'rn'
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return d === 0 || d === 6
}

// ISO-week key for grouping a staff member's hours (Thursday-anchored, matches auto-fill).
function isoWeekKey(startUtc: string): string {
  const d = new Date(startUtc)
  const thu = new Date(d)
  thu.setUTCDate(thu.getUTCDate() + 3 - ((thu.getUTCDay() + 6) % 7))
  const firstThu = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4))
  const week = Math.ceil((((thu.getTime() - firstThu.getTime()) / 86_400_000) + 1) / 7)
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v))

/**
 * Occupancy-aware cost guard (spec §9.5). When occupancy drops below full, the required
 * headcount per shift block is scaled down (never below the matrix floor); any planned shifts
 * above that requirement are proposed as cuts, ordered overtime-first, then lowest overtime
 * weighting, and never cutting the nurse floor. Each cut is priced in pence at the shift-date rate.
 *
 * Returns null when there's nothing to suggest (no snapshot / matrix / shifts, or no excess).
 */
export async function runCostGuard(
  supabase: SupabaseClient<Database>,
  homeId: string,
): Promise<RebalanceSuggestion | null> {
  // 1. Home capacity + latest occupancy snapshot
  const [{ data: home }, { data: snapshot }] = await Promise.all([
    supabase.from('homes').select('bed_capacity').eq('id', homeId).maybeSingle(),
    supabase.from('bed_occupancy_snapshots')
      .select('occupied_beds, snapshot_at')
      .eq('home_id', homeId)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (!snapshot) return null
  const capacity = num((home as { bed_capacity?: number } | null)?.bed_capacity) || 0
  const occupied = num(snapshot.occupied_beds)

  // 2. Staffing matrix (the floor per block)
  const { data: matrices } = await supabase.from('staffing_matrices').select('*').eq('home_id', homeId)
  if (!matrices?.length) return null
  const floorByBlock = new Map<string, StaffingFloor>()
  for (const m of matrices as unknown as Array<StaffingFloor & { shift_block: string }>) {
    floorByBlock.set(m.shift_block, {
      min_carers: m.min_carers, min_senior_carers: m.min_senior_carers,
      min_nurses: m.min_nurses, min_ancillary: m.min_ancillary,
    })
  }

  // 3. Upcoming shifts (next 14 days) with role + assignee
  const from = new Date().toISOString().slice(0, 10)
  const to = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  const { data: rawShifts } = await supabase
    .from('shifts')
    .select('id, staff_id, planned_start_utc, planned_paid_hours, shift_slots(role_code)')
    .eq('home_id', homeId)
    .gte('planned_start_utc', from)
    .lte('planned_start_utc', to)
    .in('state', ['unassigned', 'assigned'])
  if (!rawShifts?.length) return null

  const shifts: ShiftRow[] = (rawShifts as unknown as Array<Record<string, unknown>>).map((r) => {
    const slot = r.shift_slots as { role_code?: string } | { role_code?: string }[] | null
    const role = Array.isArray(slot) ? slot[0]?.role_code : slot?.role_code
    return {
      id: String(r.id),
      staff_id: (r.staff_id as string | null) ?? null,
      planned_start_utc: String(r.planned_start_utc),
      planned_paid_hours: r.planned_paid_hours as number,
      role_code: role ?? null,
    }
  })

  // 4. Staff, contracts and pay rates for the assignees (for weighting, overtime + pricing)
  const staffIds = [...new Set(shifts.map((s) => s.staff_id).filter((x): x is string => !!x))]
  const [staffRes, contractRes, payRes] = await Promise.all([
    staffIds.length ? supabase.from('staff').select('id, first_name, last_name, overtime_weighting').in('id', staffIds) : Promise.resolve({ data: [] as StaffRow[] }),
    staffIds.length ? supabase.from('staff_contracts').select('staff_id, contracted_hours_per_week, effective_from, effective_to').in('staff_id', staffIds) : Promise.resolve({ data: [] as ContractRow[] }),
    staffIds.length ? supabase.from('staff_pay_rates').select('staff_id, rate_weekday_pence, rate_weekend_pence, rate_overtime_pence, effective_from, effective_to').in('staff_id', staffIds) : Promise.resolve({ data: [] as PayRateRow[] }),
  ])
  const staffById = new Map<string, StaffRow>((((staffRes.data as StaffRow[]) ?? [])).map((s) => [s.id, s]))
  const contractByStaff = new Map<string, ContractRow>()
  for (const c of ((contractRes.data as ContractRow[]) ?? [])) if (!contractByStaff.has(c.staff_id)) contractByStaff.set(c.staff_id, c)
  const payByStaff = new Map<string, PayRateRow[]>()
  for (const p of ((payRes.data as PayRateRow[]) ?? [])) {
    const arr = payByStaff.get(p.staff_id) ?? []
    arr.push(p); payByStaff.set(p.staff_id, arr)
  }

  // Weekly planned hours per staff (from the 14-day window) → used to flag overtime shifts.
  const weekHoursByStaff = new Map<string, Map<string, number>>()
  for (const s of shifts) {
    if (!s.staff_id) continue
    const wk = isoWeekKey(s.planned_start_utc)
    const m = weekHoursByStaff.get(s.staff_id) ?? new Map<string, number>()
    m.set(wk, (m.get(wk) ?? 0) + num(s.planned_paid_hours))
    weekHoursByStaff.set(s.staff_id, m)
  }
  const isOvertimeShift = (s: ShiftRow): boolean => {
    if (!s.staff_id) return false
    const contract = contractByStaff.get(s.staff_id)
    if (!contract) return false
    const wk = isoWeekKey(s.planned_start_utc)
    const weekHours = weekHoursByStaff.get(s.staff_id)?.get(wk) ?? 0
    return weekHours > num(contract.contracted_hours_per_week)
  }
  const ratePence = (s: ShiftRow, overtime: boolean): number => {
    const date = s.planned_start_utc.slice(0, 10)
    const rates = (payByStaff.get(s.staff_id ?? '') ?? []).filter(
      (r) => r.effective_from <= date && (r.effective_to == null || r.effective_to > date),
    )
    const r = rates[0]
    if (!r) return DEFAULT_HOURLY_PENCE
    if (overtime && num(r.rate_overtime_pence) > 0) return num(r.rate_overtime_pence)
    if (isWeekend(date) && num(r.rate_weekend_pence) > 0) return num(r.rate_weekend_pence)
    return num(r.rate_weekday_pence) || DEFAULT_HOURLY_PENCE
  }

  // 5. Group by date + block, compute the occupancy-scaled requirement, rank cuts
  const byBlock = new Map<string, ShiftRow[]>()
  for (const s of shifts) {
    const key = `${s.planned_start_utc.slice(0, 10)}|${blockFor(s.planned_start_utc)}`
    const g = byBlock.get(key) ?? []
    g.push(s); byBlock.set(key, g)
  }

  const cuts: ProposedCut[] = []
  for (const [key, group] of byBlock) {
    const [date, block] = key.split('|') as [string, string]
    const floor = floorByBlock.get(block) ?? floorByBlock.get('morning') ?? { min_carers: 0, min_senior_carers: 0, min_nurses: 0, min_ancillary: 0 }
    const floorTotal = matrixFloorTotal(floor)

    const planned = group.length
    const required = requiredHeadcount(planned, occupied, capacity, floorTotal)
    const excess = planned - required
    if (excess <= 0) continue

    // Never cut the nurse floor: keep at least min_nurses nurse-role shifts.
    const nurseShifts = group.filter((s) => isNurseRole(s.role_code))
    const cuttableNurses = Math.max(0, nurseShifts.length - floor.min_nurses)
    const nonNurse = group.filter((s) => !isNurseRole(s.role_code))
    const pool = [...nonNurse, ...nurseShifts.slice(0, cuttableNurses)]

    // Rank: overtime first, then lowest overtime weighting, then most expensive (biggest saving).
    const scored = pool.map((s) => {
      const overtime = isOvertimeShift(s)
      const rate = ratePence(s, overtime)
      const saving = Math.round(rate * num(s.planned_paid_hours))
      const weighting = num(staffById.get(s.staff_id ?? '')?.overtime_weighting ?? 50)
      return { s, overtime, saving, weighting }
    })
    scored.sort((a, b) => {
      if (a.overtime !== b.overtime) return a.overtime ? -1 : 1
      if (a.weighting !== b.weighting) return a.weighting - b.weighting
      return b.saving - a.saving
    })

    for (const item of scored.slice(0, excess)) {
      const st = item.s.staff_id ? staffById.get(item.s.staff_id) : null
      cuts.push({
        shiftId: item.s.id,
        staffId: item.s.staff_id,
        staffName: st ? `${st.first_name} ${st.last_name}`.trim() : 'Open shift',
        shiftDate: date,
        shiftBlock: block,
        hours: num(item.s.planned_paid_hours),
        isOvertime: item.overtime,
        savingsPence: BigInt(item.saving),
        reason: item.overtime ? 'overtime' : 'above_matrix_minimum',
      })
    }
  }

  if (!cuts.length) return null

  return {
    homeId,
    proposedCuts: cuts,
    totalSavingsPence: cuts.reduce((sum, c) => sum + c.savingsPence, 0n),
    occupiedBeds: occupied,
    capacity,
    generatedAt: new Date(),
  }
}
