/**
 * AT-2: Cost guard produces RebalanceSuggestion when occupancy drops and
 * rota'd headcount exceeds matrix minimum.
 */

import { describe, it, expect } from 'vitest'
import { runCostGuard } from '../cost-guard'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@carerota/types'

// Build a minimal chainable mock for the Supabase query builder.
// Each table call resolves to a preset result when awaited or .maybeSingle()'d.
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

// Helpers
const snapshot = { occupied_beds: 35, snapshot_at: new Date().toISOString() }

const assessments = [
  { resident_id: 'r1', overall_band: 'high',   assessment_date: '2026-05-01' },
  { resident_id: 'r2', overall_band: 'medium', assessment_date: '2026-05-01' },
  { resident_id: 'r3', overall_band: 'low',    assessment_date: '2026-05-01' },
]

const matrix = [{ shift_block: 'morning', min_carers: 3, min_senior_carers: 1, min_nurses: 0, min_ancillary: 0 }]

// 6 shifts all in morning block (08:00 UTC) on tomorrow's date
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
const makeShift = (i: number) => ({
  id: `shift-${i}`,
  planned_start_utc: `${tomorrow}T08:00:00Z`,
  planned_end_utc:   `${tomorrow}T20:00:00Z`,
  planned_paid_hours: 11.5,
})
const sixShifts = Array.from({ length: 6 }, (_, i) => makeShift(i))
const fourShifts = Array.from({ length: 4 }, (_, i) => makeShift(i))

// ─── AT-2 tests ───────────────────────────────────────────────────────────────

describe('AT-2 — runCostGuard', () => {
  it('returns null when no occupancy snapshot exists', async () => {
    const client = makeClient({
      bed_occupancy_snapshots: null,
      dependency_assessments: assessments,
      staffing_matrices: matrix,
      shifts: sixShifts,
    })
    const result = await runCostGuard(client, HOME_ID)
    expect(result).toBeNull()
  })

  it('returns null when no staffing matrix is configured', async () => {
    const client = makeClient({
      bed_occupancy_snapshots: snapshot,
      dependency_assessments: assessments,
      staffing_matrices: [],
      shifts: sixShifts,
    })
    const result = await runCostGuard(client, HOME_ID)
    expect(result).toBeNull()
  })

  it('returns null when no upcoming shifts exist', async () => {
    const client = makeClient({
      bed_occupancy_snapshots: snapshot,
      dependency_assessments: assessments,
      staffing_matrices: matrix,
      shifts: [],
    })
    const result = await runCostGuard(client, HOME_ID)
    expect(result).toBeNull()
  })

  it('returns null when headcount equals matrix minimum (no excess)', async () => {
    // Matrix min total = 3+1+0+0 = 4; fourShifts has exactly 4
    const client = makeClient({
      bed_occupancy_snapshots: snapshot,
      dependency_assessments: assessments,
      staffing_matrices: matrix,
      shifts: fourShifts,
    })
    const result = await runCostGuard(client, HOME_ID)
    expect(result).toBeNull()
  })

  it('AT-2: proposes cuts when headcount exceeds matrix minimum', async () => {
    // Matrix min total = 4; sixShifts has 6 → 2 excess
    const client = makeClient({
      bed_occupancy_snapshots: snapshot,
      dependency_assessments: assessments,
      staffing_matrices: matrix,
      shifts: sixShifts,
    })
    const result = await runCostGuard(client, HOME_ID)
    expect(result).not.toBeNull()
    expect(result!.proposedCuts).toHaveLength(2)
    expect(result!.totalSavingsPence).toBeGreaterThan(0n)
    expect(result!.occupiedBeds).toBe(35)
  })

  it('AT-2: each proposed cut has a positive savingsPence', async () => {
    const client = makeClient({
      bed_occupancy_snapshots: snapshot,
      dependency_assessments: assessments,
      staffing_matrices: matrix,
      shifts: sixShifts,
    })
    const result = await runCostGuard(client, HOME_ID)
    for (const cut of result!.proposedCuts) {
      expect(cut.savingsPence).toBeGreaterThan(0n)
      expect(cut.shiftId).toBeDefined()
      expect(cut.shiftDate).toBe(tomorrow)
      expect(cut.shiftBlock).toBe('morning')
    }
  })

  it('AT-2: totalSavingsPence equals sum of individual cuts', async () => {
    const client = makeClient({
      bed_occupancy_snapshots: snapshot,
      dependency_assessments: assessments,
      staffing_matrices: matrix,
      shifts: sixShifts,
    })
    const result = await runCostGuard(client, HOME_ID)
    const summed = result!.proposedCuts.reduce((s, c) => s + c.savingsPence, 0n)
    expect(result!.totalSavingsPence).toBe(summed)
  })
})
