/**
 * Occupancy-aware cost guard (spec §9.5).
 * Required headcount is scaled by occupancy and floored at the staffing matrix minimum;
 * excess planned shifts are proposed as cuts (overtime first), priced from pay rates.
 */

import { describe, it, expect } from 'vitest'
import { runCostGuard } from '../cost-guard'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@carerota/types'

function makeChain<T>(result: T | null) {
  type Resolve = (v: { data: T | null; error: null }) => void
  const resolved = { data: result, error: null as null }
  const self: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'not', 'order', 'limit', 'gte', 'lte', 'in', 'like']) {
    self[m] = () => self
  }
  self.maybeSingle = () => Promise.resolve(resolved)
  self.then = (resolve: Resolve, reject?: (e: unknown) => void) => {
    Promise.resolve(resolved).then(resolve, reject)
  }
  return self
}

function makeClient(tableData: Record<string, unknown>) {
  return {
    from: (table: string) => makeChain(tableData[table] ?? null),
  } as unknown as SupabaseClient<Database>
}

const HOME_ID = 'home-uuid-1'
const CAPACITY = 40
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

// Matrix floor for the morning block = 3 + 1 + 0 + 0 = 4
const matrix = [{ shift_block: 'morning', min_carers: 3, min_senior_carers: 1, min_nurses: 0, min_ancillary: 0 }]

// 6 morning care-assistant shifts, one per staff member (11.5h each)
const shifts = Array.from({ length: 6 }, (_, i) => ({
  id: `shift-${i}`,
  staff_id: `staff-${i}`,
  planned_start_utc: `${tomorrow}T08:00:00Z`,
  planned_paid_hours: 11.5,
  shift_slots: { role_code: 'care_assistant' },
}))

const staff = Array.from({ length: 6 }, (_, i) => ({
  id: `staff-${i}`, first_name: 'Staff', last_name: `${i}`, overtime_weighting: 50,
}))
// Contracted well above a single 11.5h shift → nobody counts as overtime here
const contracts = staff.map((s) => ({ staff_id: s.id, contracted_hours_per_week: 36, effective_from: '2020-01-01', effective_to: null }))
// Weekday = weekend so pricing is deterministic regardless of which day `tomorrow` is
const payRates = staff.map((s) => ({ staff_id: s.id, rate_weekday_pence: 1221, rate_weekend_pence: 1221, rate_overtime_pence: 1923, effective_from: '2020-01-01', effective_to: null }))

function client(occupied: number, overrides: Record<string, unknown> = {}) {
  return makeClient({
    homes: { bed_capacity: CAPACITY },
    bed_occupancy_snapshots: { occupied_beds: occupied, snapshot_at: new Date().toISOString() },
    staffing_matrices: matrix,
    shifts,
    staff,
    staff_contracts: contracts,
    staff_pay_rates: payRates,
    ...overrides,
  })
}

describe('runCostGuard — occupancy-scaled', () => {
  it('returns null with no occupancy snapshot', async () => {
    expect(await runCostGuard(client(24, { bed_occupancy_snapshots: null }), HOME_ID)).toBeNull()
  })

  it('returns null with no staffing matrix', async () => {
    expect(await runCostGuard(client(24, { staffing_matrices: [] }), HOME_ID)).toBeNull()
  })

  it('returns null with no upcoming shifts', async () => {
    expect(await runCostGuard(client(24, { shifts: [] }), HOME_ID)).toBeNull()
  })

  it('proposes NO cuts at full occupancy (required == planned)', async () => {
    // 40/40 → required = ceil(6*1) = 6 = planned → no excess
    expect(await runCostGuard(client(40), HOME_ID)).toBeNull()
  })

  it('proposes cuts as occupancy drops', async () => {
    // 24/40 = 0.6 → required = max(4, ceil(6*0.6)=4) = 4 → 2 excess
    const res = await runCostGuard(client(24), HOME_ID)
    expect(res).not.toBeNull()
    expect(res!.proposedCuts).toHaveLength(2)
    expect(res!.occupiedBeds).toBe(24)
    expect(res!.capacity).toBe(40)
  })

  it('never cuts below the matrix floor, even at very low occupancy', async () => {
    // 4/40 = 0.1 → ceil(6*0.1)=1 but floor 4 → required 4 → only 2 cuts (not 5)
    const res = await runCostGuard(client(4), HOME_ID)
    expect(res!.proposedCuts).toHaveLength(2)
  })

  it('prices each cut from the pay rate and sums the total', async () => {
    const res = await runCostGuard(client(24), HOME_ID)
    for (const cut of res!.proposedCuts) {
      expect(cut.savingsPence).toBe(BigInt(Math.round(1221 * 11.5))) // 14042
      expect(cut.shiftDate).toBe(tomorrow)
      expect(cut.shiftBlock).toBe('morning')
    }
    const summed = res!.proposedCuts.reduce((s, c) => s + c.savingsPence, 0n)
    expect(res!.totalSavingsPence).toBe(summed)
  })

  it('cuts overtime shifts first and prices them at the overtime rate', async () => {
    // staff-0 gets two 20h shifts in the same week → 40h > 36 contracted → overtime.
    const otShifts = [
      { id: 'ot-a', staff_id: 'staff-0', planned_start_utc: `${tomorrow}T08:00:00Z`, planned_paid_hours: 20, shift_slots: { role_code: 'care_assistant' } },
      { id: 'ot-b', staff_id: 'staff-0', planned_start_utc: `${tomorrow}T20:00:00Z`, planned_paid_hours: 20, shift_slots: { role_code: 'care_assistant' } },
      ...shifts.slice(1), // staff-1..5, single 11.5h morning shifts (not overtime)
    ]
    const res = await runCostGuard(client(24, { shifts: otShifts }), HOME_ID)
    const first = res!.proposedCuts[0]
    expect(first.staffId).toBe('staff-0')
    expect(first.isOvertime).toBe(true)
    expect(first.reason).toBe('overtime')
    expect(first.savingsPence).toBe(BigInt(Math.round(1923 * 20))) // overtime rate
  })
})
