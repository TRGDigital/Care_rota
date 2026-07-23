import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@carerota/types'

// Occupancy-driven overtime trimming (Option B, confirmed with product).
//
// When occupancy drops below full, the overtime that was justified at full occupancy is no
// longer needed. Rather than deleting whole shifts, we REDUCE the hours on each affected staff
// member's LAST contracted day of the week, down towards their contracted hours — so a nurse on
// 4×12h (48h) against a 40h contract has her last day shaved, not removed.
//
// Two product rules fall out of this cleanly:
//  - We only ever shave *overtime* hours (never contracted hours, never a whole body), so
//    contracted coverage is preserved and you're never "left with nobody working".
//  - The best workers keep their overtime longest: the shed is taken from the LOWEST overtime
//    weighting first (per §"weighting the overtime").
//
// NOTE (refinement, not yet modelled): shaving the tail of a long day could in theory dip a
// block below its matrix floor for that last hour or two. A follow-up will check the block's
// coverage over the trimmed window before confirming. For now trims are capped at the overtime
// portion only, which keeps the contracted rota (and its floor) intact.

export type StaffWeekOvertime = {
  staffId: string
  staffName: string
  weekKey: string
  lastShiftId: string
  lastShiftHours: number
  overtimeHours: number      // weekHours - contracted, always > 0 for entries passed in
  overtimeWeighting: number  // 0..100; lower = shed first
  overtimeRatePence: number
  eligible: boolean          // false = ancillary/discretionary overtime → shed first
}

export type OvertimeTrim = {
  staffId: string
  staffName: string
  weekKey: string
  shiftId: string
  currentHours: number
  reduceHoursBy: number
  newHours: number
  savingsPence: bigint
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Plan the overtime trims for one home given the current occupancy ratio.
 *
 * Per ISO week, the total overtime to shed is `totalOvertime * (1 - occupancyRatio)` (so a 10%
 * drop in occupancy sheds ~10% of that week's overtime). The shed is taken from the lowest
 * overtime weighting first, reducing each person's last-of-week shift down to their contracted
 * hours, until the target is met. Pure and deterministic.
 */
export function planOvertimeTrims(overtimes: StaffWeekOvertime[], occupancyRatio: number): OvertimeTrim[] {
  const ratio = clamp(Number.isFinite(occupancyRatio) ? occupancyRatio : 1, 0, 1)
  if (ratio >= 1) return [] // full occupancy → keep all overtime

  // Group by week
  const byWeek = new Map<string, StaffWeekOvertime[]>()
  for (const o of overtimes) {
    if (o.overtimeHours <= 0) continue
    const arr = byWeek.get(o.weekKey) ?? []
    arr.push(o); byWeek.set(o.weekKey, arr)
  }

  const trims: OvertimeTrim[] = []
  for (const [, staff] of byWeek) {
    const totalOvertime = staff.reduce((s, o) => s + o.overtimeHours, 0)
    let remaining = round2(totalOvertime * (1 - ratio))
    if (remaining <= 0) continue

    // Shed order: discretionary (non-eligible/ancillary) overtime first, then lowest weighting,
    // then larger overtime. So the best hands-on workers keep their overtime longest.
    const ordered = [...staff].sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? 1 : -1
      if (a.overtimeWeighting !== b.overtimeWeighting) return a.overtimeWeighting - b.overtimeWeighting
      return b.overtimeHours - a.overtimeHours
    })

    for (const o of ordered) {
      if (remaining <= 0) break
      // Can't shave more than the overtime, nor more than the last shift's own hours.
      const trimmable = Math.min(o.overtimeHours, o.lastShiftHours)
      const reduceBy = round2(Math.min(trimmable, remaining))
      if (reduceBy <= 0) continue
      trims.push({
        staffId: o.staffId,
        staffName: o.staffName,
        weekKey: o.weekKey,
        shiftId: o.lastShiftId,
        currentHours: round2(o.lastShiftHours),
        reduceHoursBy: reduceBy,
        newHours: round2(o.lastShiftHours - reduceBy),
        savingsPence: BigInt(Math.round(reduceBy * o.overtimeRatePence)),
      })
      remaining = round2(remaining - reduceBy)
    }
  }
  return trims
}

// ── Async wrapper: gather the data and plan the trims for a home ─────────────────

type ShiftRow = { id: string; staff_id: string | null; planned_start_utc: string; planned_paid_hours: number | string }
type StaffRow = { id: string; first_name: string; last_name: string; overtime_weighting: number | null; overtime_eligible: boolean | null }
type ContractRow = { staff_id: string; contracted_hours_per_week: number | string; effective_from: string; effective_to: string | null }
type PayRateRow = { staff_id: string; rate_overtime_pence: number | string | null; rate_weekday_pence: number | string | null; effective_from: string; effective_to: string | null }

const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v))

function isoWeekKey(startUtc: string): string {
  const d = new Date(startUtc)
  const thu = new Date(d)
  thu.setUTCDate(thu.getUTCDate() + 3 - ((thu.getUTCDay() + 6) % 7))
  const firstThu = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4))
  const week = Math.ceil((((thu.getTime() - firstThu.getTime()) / 86_400_000) + 1) / 7)
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export type OvertimeTrimResult = {
  homeId: string
  occupiedBeds: number
  capacity: number
  trims: OvertimeTrim[]
  totalSavingsPence: bigint
} | null

/**
 * Compute overtime trims for a home over the next `weeksAhead` weeks (default 26) given the
 * latest occupancy snapshot. Returns null when there's nothing to trim.
 */
export async function runOvertimeTrim(
  supabase: SupabaseClient<Database>,
  homeId: string,
  opts?: { weeksAhead?: number },
): Promise<OvertimeTrimResult> {
  const weeksAhead = opts?.weeksAhead ?? 26

  const [{ data: home }, { data: snapshot }] = await Promise.all([
    supabase.from('homes').select('bed_capacity').eq('id', homeId).maybeSingle(),
    supabase.from('bed_occupancy_snapshots').select('occupied_beds').eq('home_id', homeId).order('snapshot_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!snapshot) return null
  const capacity = num((home as { bed_capacity?: number } | null)?.bed_capacity)
  const occupied = num(snapshot.occupied_beds)
  if (capacity <= 0) return null
  const ratio = occupied / capacity
  if (ratio >= 1) return null

  const from = new Date().toISOString().slice(0, 10)
  const to = new Date(Date.now() + weeksAhead * 7 * 86_400_000).toISOString().slice(0, 10)
  const { data: rawShifts } = await supabase
    .from('shifts')
    .select('id, staff_id, planned_start_utc, planned_paid_hours')
    .eq('home_id', homeId)
    .gte('planned_start_utc', from)
    .lte('planned_start_utc', to)
    .in('state', ['assigned'])
  const shifts = ((rawShifts as ShiftRow[] | null) ?? []).filter((s) => s.staff_id)
  if (!shifts.length) return null

  const staffIds = [...new Set(shifts.map((s) => s.staff_id as string))]
  const [staffRes, contractRes, payRes] = await Promise.all([
    supabase.from('staff').select('id, first_name, last_name, overtime_weighting, overtime_eligible').in('id', staffIds),
    supabase.from('staff_contracts').select('staff_id, contracted_hours_per_week, effective_from, effective_to').in('staff_id', staffIds),
    supabase.from('staff_pay_rates').select('staff_id, rate_overtime_pence, rate_weekday_pence, effective_from, effective_to').in('staff_id', staffIds),
  ])
  const staffById = new Map<string, StaffRow>(((staffRes.data as StaffRow[]) ?? []).map((s) => [s.id, s]))
  const contractByStaff = new Map<string, ContractRow>()
  for (const c of ((contractRes.data as ContractRow[]) ?? [])) if (!contractByStaff.has(c.staff_id)) contractByStaff.set(c.staff_id, c)
  const payByStaff = new Map<string, PayRateRow[]>()
  for (const p of ((payRes.data as PayRateRow[]) ?? [])) { const a = payByStaff.get(p.staff_id) ?? []; a.push(p); payByStaff.set(p.staff_id, a) }

  // Build per-staff-per-week hours + the last shift of each week.
  type Agg = { hours: number; last: ShiftRow }
  const perStaffWeek = new Map<string, Map<string, Agg>>()
  for (const s of shifts) {
    const sid = s.staff_id as string
    const wk = isoWeekKey(s.planned_start_utc)
    const weeks = perStaffWeek.get(sid) ?? new Map<string, Agg>()
    const agg = weeks.get(wk)
    if (!agg) weeks.set(wk, { hours: num(s.planned_paid_hours), last: s })
    else {
      agg.hours += num(s.planned_paid_hours)
      if (s.planned_start_utc > agg.last.planned_start_utc) agg.last = s
    }
    perStaffWeek.set(sid, weeks)
  }

  const overtimes: StaffWeekOvertime[] = []
  for (const [sid, weeks] of perStaffWeek) {
    const contract = contractByStaff.get(sid)
    if (!contract) continue
    const contracted = num(contract.contracted_hours_per_week)
    const st = staffById.get(sid)
    const rates = payByStaff.get(sid) ?? []
    for (const [wk, agg] of weeks) {
      const overtime = round2(agg.hours - contracted)
      if (overtime <= 0) continue
      const date = agg.last.planned_start_utc.slice(0, 10)
      const rate = rates.find((r) => r.effective_from <= date && (r.effective_to == null || r.effective_to > date))
      const overtimeRate = num(rate?.rate_overtime_pence) || num(rate?.rate_weekday_pence)
      overtimes.push({
        staffId: sid,
        staffName: st ? `${st.first_name} ${st.last_name}`.trim() : 'Staff member',
        weekKey: wk,
        lastShiftId: agg.last.id,
        lastShiftHours: num(agg.last.planned_paid_hours),
        overtimeHours: overtime,
        overtimeWeighting: num(st?.overtime_weighting ?? 50),
        overtimeRatePence: overtimeRate,
        eligible: st?.overtime_eligible !== false,
      })
    }
  }

  const trims = planOvertimeTrims(overtimes, ratio)
  if (!trims.length) return null

  return {
    homeId,
    occupiedBeds: occupied,
    capacity,
    trims,
    totalSavingsPence: trims.reduce((s, t) => s + t.savingsPence, 0n),
  }
}
