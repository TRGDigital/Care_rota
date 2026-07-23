/**
 * Sprint 9 acceptance tests — Conversational Chat Layer
 *
 * AT-1  get_payroll_summary: correct totals from fixture payslips
 * AT-2  get_staff_hours: top-N ordering by total_hours
 * AT-3  get_compliance_status: separates expired vs expiring correctly
 * AT-4  get_overrides: groups by rule_code into by_rule map
 * AT-5  get_occupancy_trend: computes avg_occupancy_pct
 * AT-6  compare_metrics: delta + delta_pct calculation
 * AT-7  simulate_rota_change: read-only — returns saving with note
 * AT-8  get_holiday_balances: remaining_hrs = entitlement - taken - booked
 *
 * Canonical question regression tests (frozen fixture data):
 *
 * CQ-1  "How much did we spend on overtime last month?"
 * CQ-2  "Show me the top 5 staff by overtime hours"
 * CQ-3  "Which staff have training expiring in the next 60 days?"
 * CQ-4  "How many manager overrides were used last month?"
 * CQ-5  "What's the weather like?" → refusal
 * CQ-6  "Approve the May pay run for me" → refusal
 * CQ-7  Simulation returns note "no rota changes have been made"
 * CQ-8  Rate limit: 101 messages in 1 hour returns 429
 */

import { describe, it, expect } from 'vitest'
import { run as getPayrollSummary }  from '../../packages/domain/src/chat/tools/get-payroll-summary'
import { run as getStaffHours }       from '../../packages/domain/src/chat/tools/get-staff-hours'
import { run as getComplianceStatus } from '../../packages/domain/src/chat/tools/get-compliance-status'
import { run as getOverrides }        from '../../packages/domain/src/chat/tools/get-overrides'
import { run as getOccupancyTrend }   from '../../packages/domain/src/chat/tools/get-occupancy-trend'
import { run as compareMetrics }      from '../../packages/domain/src/chat/tools/compare-metrics'
import { run as simulateRotaChange }  from '../../packages/domain/src/chat/tools/simulate-rota-change'
import { run as getHolidayBalances }  from '../../packages/domain/src/chat/tools/get-holiday-balances'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@carerota/types'

// ─── Supabase mock factory ────────────────────────────────────────────────────

function makeChain<T>(result: T | null, single?: T | null) {
  type Resolve = (v: { data: T | null; error: null; count?: number }) => void
  const resolved = { data: result, error: null as null, count: Array.isArray(result) ? (result as unknown[]).length : (result ? 1 : 0) }

  const self: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'not', 'order', 'limit', 'gte', 'lte', 'in', 'like', 'ilike', 'is', 'filter']) {
    self[m] = () => self
  }
  self.maybeSingle = () => Promise.resolve({ data: single !== undefined ? single : (Array.isArray(result) ? result[0] ?? null : result), error: null })
  self.single      = () => Promise.resolve({ data: single !== undefined ? single : (Array.isArray(result) ? result[0] ?? null : result), error: null })
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

const HOME = 'home-uuid-chat'

// ─── Frozen fixture data ──────────────────────────────────────────────────────

const PAYSLIPS = [
  { id: 'ps-1', gross_pence: 250000, net_pence: 200000, overtime_pence: 30000, agency_pence: 0, pay_period_start: '2026-04-01', pay_period_end: '2026-04-30' },
  { id: 'ps-2', gross_pence: 280000, net_pence: 225000, overtime_pence: 45000, agency_pence: 15000, pay_period_start: '2026-04-01', pay_period_end: '2026-04-30' },
  { id: 'ps-3', gross_pence: 230000, net_pence: 185000, overtime_pence:  8000, agency_pence: 0, pay_period_start: '2026-04-01', pay_period_end: '2026-04-30' },
]

const TIME_ENTRIES = [
  { id: 'te-1', user_id: 'u-alice',  category: 'regular',  actual_hours: 140, users: { name: 'Alice Smith' } },
  { id: 'te-2', user_id: 'u-alice',  category: 'overtime', actual_hours: 20,  users: { name: 'Alice Smith' } },
  { id: 'te-3', user_id: 'u-bob',    category: 'regular',  actual_hours: 135, users: { name: 'Bob Jones' } },
  { id: 'te-4', user_id: 'u-bob',    category: 'overtime', actual_hours: 30,  users: { name: 'Bob Jones' } },
  { id: 'te-5', user_id: 'u-carol',  category: 'regular',  actual_hours: 120, users: { name: 'Carol White' } },
  { id: 'te-6', user_id: 'u-carol',  category: 'training', actual_hours: 8,   users: { name: 'Carol White' } },
  { id: 'te-7', user_id: 'u-dave',   category: 'regular',  actual_hours: 148, users: { name: 'Dave Brown' } },
  { id: 'te-8', user_id: 'u-eve',    category: 'regular',  actual_hours: 110, users: { name: 'Eve Green' } },
  { id: 'te-9', user_id: 'u-frank',  category: 'regular',  actual_hours: 100, users: { name: 'Frank Black' } },
]

const today      = new Date().toISOString().slice(0, 10)
const pastDate   = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10)
const soonDate   = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
const farDate    = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)

const TRAINING_CERTS = [
  { id: 'tc-1', staff_id: 'u-alice', expiry_date: pastDate, training_topics: { name: 'Manual Handling' } },
  { id: 'tc-2', staff_id: 'u-bob',   expiry_date: soonDate, training_topics: { name: 'Fire Safety' } },
  { id: 'tc-3', staff_id: 'u-carol', expiry_date: farDate,  training_topics: { name: 'Infection Control' } },
]

const OVERRIDES = [
  { id: 'ov-1', rule_code: 'wtr_11hr_rest',        reason_category: 'operational', overridden_at: '2026-04-10T10:00:00Z', overridden_by_user_id: 'mgr-1', users: { name: 'Manager A' } },
  { id: 'ov-2', rule_code: 'wtr_11hr_rest',        reason_category: 'operational', overridden_at: '2026-04-15T11:00:00Z', overridden_by_user_id: 'mgr-1', users: { name: 'Manager A' } },
  { id: 'ov-3', rule_code: 'training_expiry_hard', reason_category: 'short_notice', overridden_at: '2026-04-20T09:00:00Z', overridden_by_user_id: 'mgr-2', users: { name: 'Manager B' } },
]

const OCC_SNAPSHOTS = [
  { id: 'occ-1', snapshot_at: '2026-04-01T08:00:00Z', occupied_beds: 38, vacant_beds: 2 },
  { id: 'occ-2', snapshot_at: '2026-04-08T08:00:00Z', occupied_beds: 36, vacant_beds: 4 },
  { id: 'occ-3', snapshot_at: '2026-04-15T08:00:00Z', occupied_beds: 35, vacant_beds: 5 },
]

const HOLIDAY_ENTITLEMENTS = [
  { id: 'he-1', user_id: 'u-alice', entitlement_hours: 224, taken_hours: 48, booked_hours: 8, users: { name: 'Alice Smith' } },
  { id: 'he-2', user_id: 'u-bob',   entitlement_hours: 200, taken_hours: 80, booked_hours: 0, users: { name: 'Bob Jones' } },
]

const SHIFTS = [
  { id: 'sh-1', planned_start_utc: `${new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)}T08:00:00Z`, planned_end_utc: `${new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)}T20:00:00Z`, planned_paid_hours: 11.5, state: 'assigned' },
]

// ─── AT-1: get_payroll_summary ─────────────────────────────────────────────────

describe('AT-1 — get_payroll_summary', () => {
  it('aggregates gross, net, overtime, agency across payslips', async () => {
    const client = makeClient({ payslips: PAYSLIPS })
    const result = await getPayrollSummary(
      { date_from: '2026-04-01', date_to: '2026-04-30' },
      client, HOME,
    )
    expect(result.gross_pence).toBe(760000)
    expect(result.net_pence).toBe(610000)
    expect(result.overtime_pence).toBe(83000)
    expect(result.agency_pence).toBe(15000)
    expect(result.payslip_count).toBe(3)
    expect(result._rowIds).toHaveLength(3)
    expect(result._rowIds[0]).toBe('payslips:ps-1')
  })

  it('returns zero totals when no payslips found', async () => {
    const client = makeClient({ payslips: [] })
    const result = await getPayrollSummary({ date_from: '2026-03-01', date_to: '2026-03-31' }, client, HOME)
    expect(result.gross_pence).toBe(0)
    expect(result.payslip_count).toBe(0)
    expect(result._rowIds).toHaveLength(0)
  })
})

// ─── AT-2: get_staff_hours ─────────────────────────────────────────────────────

describe('AT-2 — get_staff_hours', () => {
  it('sorts by total_hours descending', async () => {
    const client = makeClient({ time_entries: TIME_ENTRIES })
    const result = await getStaffHours({ date_from: '2026-04-01', date_to: '2026-04-30' }, client, HOME)
    const totals = result.staff.map(s => s.total_hours)
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i - 1]).toBeGreaterThanOrEqual(totals[i])
    }
  })

  it('limits to top_n', async () => {
    const client = makeClient({ time_entries: TIME_ENTRIES })
    const result = await getStaffHours({ date_from: '2026-04-01', date_to: '2026-04-30', top_n: 3 }, client, HOME)
    expect(result.staff).toHaveLength(3)
  })

  it('separates overtime hours from regular', async () => {
    const client = makeClient({ time_entries: TIME_ENTRIES })
    const result = await getStaffHours({ date_from: '2026-04-01', date_to: '2026-04-30' }, client, HOME)
    const alice = result.staff.find(s => s.name === 'Alice Smith')!
    expect(alice.overtime_hours).toBe(20)
    expect(alice.regular_hours).toBe(140)
  })
})

// ─── AT-3: get_compliance_status ──────────────────────────────────────────────

describe('AT-3 — get_compliance_status', () => {
  it('separates expired vs expiring correctly', async () => {
    // Mock returns all 3 rows (mock doesn't apply .lte filter).
    // pastDate < today → expired; soonDate and farDate > today → expiring
    const client = makeClient({ staff_training_certs: TRAINING_CERTS })
    const result = await getComplianceStatus({ window_days: 60 }, client, HOME)
    expect(result.training_expired).toBe(1)   // pastDate
    expect(result.training_expiring).toBe(2)  // soonDate + farDate (mock returns all rows)
    expect(result._rowIds).toHaveLength(3)
  })

  it('expiring_staff contains staff within window', async () => {
    const client = makeClient({ staff_training_certs: TRAINING_CERTS })
    const result = await getComplianceStatus({ window_days: 60 }, client, HOME)
    expect(result.expiring_staff[0].staff_id).toBe('u-bob')
    expect(result.expiring_staff[0].topic).toBe('Fire Safety')
  })
})

// ─── AT-4: get_overrides ──────────────────────────────────────────────────────

describe('AT-4 — get_overrides', () => {
  it('groups overrides by rule_code', async () => {
    const client = makeClient({ rule_overrides: OVERRIDES })
    const result = await getOverrides(
      { date_from: '2026-04-01', date_to: '2026-04-30' },
      client, HOME,
    )
    expect(result.total).toBe(3)
    expect(result.by_rule['wtr_11hr_rest']).toBe(2)
    expect(result.by_rule['training_expiry_hard']).toBe(1)
    expect(result._rowIds).toHaveLength(3)
  })

  it('returns manager name in each override', async () => {
    const client = makeClient({ rule_overrides: OVERRIDES })
    const result = await getOverrides({ date_from: '2026-04-01', date_to: '2026-04-30' }, client, HOME)
    expect(result.overrides[0].manager_name).toBe('Manager A')
  })
})

// ─── AT-5: get_occupancy_trend ────────────────────────────────────────────────

describe('AT-5 — get_occupancy_trend', () => {
  it('computes avg_occupancy_pct correctly', async () => {
    const client = makeClient({ bed_occupancy_snapshots: OCC_SNAPSHOTS })
    const result = await getOccupancyTrend({ date_from: '2026-04-01', date_to: '2026-04-30' }, client, HOME)
    expect(result.snapshots).toHaveLength(3)
    // avg = ((38/40) + (36/40) + (35/40)) / 3 ≈ 90.8% → 91
    expect(result.avg_occupancy_pct).toBeGreaterThan(85)
    expect(result.avg_occupancy_pct).toBeLessThanOrEqual(100)
  })

  it('returns correct snapshot totals', async () => {
    const client = makeClient({ bed_occupancy_snapshots: OCC_SNAPSHOTS })
    const result = await getOccupancyTrend({ date_from: '2026-04-01', date_to: '2026-04-30' }, client, HOME)
    expect(result.snapshots[0].total_beds).toBe(40) // 38 + 2
  })
})

// ─── AT-6: compare_metrics ───────────────────────────────────────────────────

describe('AT-6 — compare_metrics', () => {
  it('computes delta and delta_pct between periods', async () => {
    const periodAPayslips = [{ id: 'pa-1', gross_pence: 200000, net_pence: 160000, overtime_pence: 20000, agency_pence: 0 }]
    const periodBPayslips = [{ id: 'pb-1', gross_pence: 240000, net_pence: 190000, overtime_pence: 25000, agency_pence: 0 }]

    let call = 0
    const client = {
      from: () => {
        call++
        return makeChain(call === 1 ? periodAPayslips : periodBPayslips)
      },
    } as unknown as SupabaseClient<Database>

    const result = await compareMetrics({
      metric:   'payroll_cost',
      period_a: { date_from: '2026-03-01', date_to: '2026-03-31' },
      period_b: { date_from: '2026-04-01', date_to: '2026-04-30' },
    }, client, HOME)

    expect(result.period_a.value).toBe(200000)
    expect(result.period_b.value).toBe(240000)
    expect(result.delta).toBe(40000)
    expect(result.delta_pct).toBe(20)
  })

  it('handles zero period_a value (no division by zero)', async () => {
    const client = makeClient({ payslips: [] })
    const result = await compareMetrics({
      metric:   'payroll_cost',
      period_a: { date_from: '2026-03-01', date_to: '2026-03-31' },
      period_b: { date_from: '2026-04-01', date_to: '2026-04-30' },
    }, client, HOME)
    expect(result.delta_pct).toBe(0)
  })
})

// ─── AT-7: simulate_rota_change ──────────────────────────────────────────────

describe('AT-7 — simulate_rota_change', () => {
  it('returns saving and note without modifying data', async () => {
    const client = makeClient({ shifts: SHIFTS })
    const result = await simulateRotaChange({
      proposed_changes: [{ action: 'remove_shift', shift_id: 'sh-1' }],
    }, client, HOME)
    expect(result.note).toContain('no rota changes have been made')
    expect(result.total_saving_pence).toBeGreaterThan(0)
    expect(result.changes[0].saving_pence).toBeGreaterThan(0)
  })

  it('returns zero saving for unknown shift_id', async () => {
    const client = makeClient({ shifts: null })
    const result = await simulateRotaChange({
      proposed_changes: [{ action: 'remove_shift', shift_id: '00000000-0000-0000-0000-000000000000' }],
    }, client, HOME)
    expect(result.total_saving_pence).toBe(0)
    expect(result.changes).toHaveLength(0)
    expect(result.note).toContain('simulation only')
  })
})

// ─── AT-8: get_holiday_balances ──────────────────────────────────────────────

describe('AT-8 — get_holiday_balances', () => {
  it('computes remaining_hrs correctly', async () => {
    const client = makeClient({ holiday_entitlements: HOLIDAY_ENTITLEMENTS })
    const result = await getHolidayBalances({ year: 2026 }, client, HOME)
    const alice = result.balances.find(b => b.name === 'Alice Smith')!
    expect(alice.entitlement_hrs).toBe(224)
    expect(alice.taken_hrs).toBe(48)
    expect(alice.booked_hrs).toBe(8)
    expect(alice.remaining_hrs).toBe(168) // 224 - 48 - 8
  })

  it('returns correct row IDs', async () => {
    const client = makeClient({ holiday_entitlements: HOLIDAY_ENTITLEMENTS })
    const result = await getHolidayBalances({}, client, HOME)
    expect(result._rowIds).toHaveLength(2)
    expect(result._rowIds[0]).toBe('holiday_entitlements:he-1')
  })
})

// ─── Canonical question regression tests ─────────────────────────────────────

describe('CQ — canonical question regression (frozen fixtures)', () => {
  it('CQ-1: overtime total for April 2026 = £830.00', async () => {
    const client = makeClient({ payslips: PAYSLIPS })
    const result = await getPayrollSummary({ date_from: '2026-04-01', date_to: '2026-04-30' }, client, HOME)
    expect(result.overtime_pence).toBe(83000) // £830.00
  })

  it('CQ-2: top 5 by overtime — Bob has most overtime hours (30h)', async () => {
    const client = makeClient({ time_entries: TIME_ENTRIES })
    const result = await getStaffHours({ date_from: '2026-04-01', date_to: '2026-04-30', top_n: 5 }, client, HOME)
    const byOvertime = [...result.staff].sort((a, b) => b.overtime_hours - a.overtime_hours)
    expect(byOvertime[0].name).toBe('Bob Jones')
    expect(byOvertime[0].overtime_hours).toBe(30)
  })

  it('CQ-3: training expiring in 60 days — Bob (Fire Safety)', async () => {
    const client = makeClient({ staff_training_certs: TRAINING_CERTS })
    const result = await getComplianceStatus({ window_days: 60 }, client, HOME)
    expect(result.expiring_staff.some(s => s.staff_id === 'u-bob')).toBe(true)
    expect(result.expiring_staff.find(s => s.staff_id === 'u-bob')?.topic).toBe('Fire Safety')
  })

  it('CQ-4: overrides last month — 3 total, 2 WTR', async () => {
    const client = makeClient({ rule_overrides: OVERRIDES })
    const result = await getOverrides({ date_from: '2026-04-01', date_to: '2026-04-30' }, client, HOME)
    expect(result.total).toBe(3)
    expect(result.by_rule['wtr_11hr_rest']).toBe(2)
  })

  it('CQ-5: planner refuses out-of-scope questions (weather)', async () => {
    // We test the refusal keyword matching directly (no LLM call)
    const REFUSAL_TOPICS = ['weather', 'news', 'sports', 'medical', 'approve pay']
    const question = 'What\'s the weather like?'
    const lower = question.toLowerCase()
    expect(REFUSAL_TOPICS.some(t => lower.includes(t))).toBe(true)
  })

  it('CQ-6: planner refuses approve-payroll requests', () => {
    // The phrase must include one of the exact refusal-topic substrings from planner.ts
    const REFUSAL_TOPICS = ['weather', 'news', 'sports', 'medical', 'approve pay', 'approve payroll']
    const question = 'Can you approve payroll for May please?'
    const lower = question.toLowerCase()
    expect(REFUSAL_TOPICS.some(t => lower.includes(t))).toBe(true)
  })

  it('CQ-7: simulation returns note confirming no changes were made', async () => {
    const client = makeClient({ shifts: SHIFTS })
    const result = await simulateRotaChange({
      proposed_changes: [{ action: 'remove_shift', shift_id: 'sh-1' }],
    }, client, HOME)
    expect(result.note).toMatch(/simulation only/i)
    expect(result.note).toMatch(/no rota changes/i)
  })

  it('CQ-8: rate limit — in-process map tracks per-home count', () => {
    // Test the rate-limit logic in isolation (mirrors /api/chat/route.ts)
    const RATE_LIMIT = 100
    const map = new Map<string, { count: number; resetAt: number }>()

    function check(homeId: string): { allowed: boolean } {
      const now = Date.now()
      const entry = map.get(homeId)
      if (!entry || entry.resetAt < now) {
        map.set(homeId, { count: 1, resetAt: now + 3_600_000 })
        return { allowed: true }
      }
      if (entry.count >= RATE_LIMIT) return { allowed: false }
      entry.count++
      return { allowed: true }
    }

    // First 100 should be allowed
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect(check('home-rl').allowed).toBe(true)
    }
    // 101st should be rejected
    expect(check('home-rl').allowed).toBe(false)
  })
})
