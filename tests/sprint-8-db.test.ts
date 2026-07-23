/**
 * Sprint 8 DB integration tests.
 * Requires: supabase start (local instance on port 54322).
 *
 * AT-3:  cost_savings_log is INSERT-only for the 'authenticated' role.
 * AT-13: dependency_assessments.source can store 'imported_from_carestream'.
 * AT-14: application-level upsert guards (index on home_id + external_resident_ref).
 * Schema: Sprint 8 tables (residents, cost_savings_log, staffing_matrices) exist.
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import pg from 'pg'

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let pool: pg.Pool

beforeAll(() => {
  pool = new pg.Pool({ connectionString: DB_URL, max: 3 })
})

afterAll(async () => {
  await pool.end()
})

async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string, params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect()
  try {
    return await client.query<T>(sql, params)
  } finally {
    client.release()
  }
}

async function asAuthenticated<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL ROLE authenticated")
    const result = await fn(client)
    await client.query('ROLLBACK')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// ─── Shared test org/home ────────────────────────────────────────────────────

let orgId: string
let homeId: string

beforeAll(async () => {
  const { rows: [org] } = await query<{ id: string }>(
    `INSERT INTO public.organisations (name) VALUES ($1) RETURNING id`,
    [`Sprint 8 Test Org ${Date.now()}`],
  )
  orgId = org.id

  const { rows: [home] } = await query<{ id: string }>(
    `INSERT INTO public.homes (organisation_id, name, address, registration_type, bed_capacity, time_zone)
     VALUES ($1, $2, '1 Sprint8 Lane', 'residential', 40, 'Europe/London') RETURNING id`,
    [orgId, `Sprint 8 Test Home ${Date.now()}`],
  )
  homeId = home.id
})

afterAll(async () => {
  if (homeId) {
    await query(`DELETE FROM public.dependency_assessments WHERE home_id = $1`, [homeId])
    await query(`DELETE FROM public.residents             WHERE home_id = $1`, [homeId])
    await query(`DELETE FROM public.beds                  WHERE home_id = $1`, [homeId])
    await query(`DELETE FROM public.cost_savings_log      WHERE home_id = $1`, [homeId])
    await query(`DELETE FROM public.staffing_matrices     WHERE home_id = $1`, [homeId])
    await query(`DELETE FROM public.homes                 WHERE id = $1`, [homeId])
  }
  if (orgId) {
    await query(`DELETE FROM public.organisations WHERE id = $1`, [orgId])
  }
})

// ─── Schema: Sprint 8 tables exist ───────────────────────────────────────────

describe('Sprint 8 schema', () => {
  const tables = ['residents', 'cost_savings_log', 'staffing_matrices', 'bed_occupancy_snapshots']
  for (const t of tables) {
    it(`table '${t}' exists in public schema`, async () => {
      const { rows } = await query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`, [t],
      )
      expect(rows.length).toBe(1)
    })
  }

  it('dependency_source enum exists with correct values', async () => {
    const { rows } = await query(
      `SELECT enumlabel FROM pg_enum
       JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
       WHERE pg_type.typname = 'dependency_source'
       ORDER BY enumlabel`,
    )
    const labels = rows.map((r: { enumlabel: string }) => r.enumlabel)
    expect(labels).toEqual(['carerota_native', 'imported_from_carestream', 'manual_csv'])
  })

  it('residents has index on (home_id, external_resident_ref) for AT-14 upsert lookups', async () => {
    const { rows } = await query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'residents' AND indexdef ILIKE '%external_resident_ref%'`,
    )
    expect(rows.length).toBeGreaterThan(0)
  })
})

// ─── AT-3: cost_savings_log is INSERT-only ────────────────────────────────────

describe('AT-3 — cost_savings_log is INSERT-only for authenticated', () => {
  it('UPDATE is rejected', async () => {
    await expect(
      asAuthenticated(async client => {
        await client.query(`UPDATE public.cost_savings_log SET id = id WHERE false`)
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('DELETE is rejected', async () => {
    await expect(
      asAuthenticated(async client => {
        await client.query(`DELETE FROM public.cost_savings_log WHERE false`)
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('INSERT succeeds for superuser (service role)', async () => {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO public.cost_savings_log
         (tenant_id, home_id, source, savings_pence)
       VALUES ($1, $1, 'occupancy_rebalance', 5000)
       RETURNING id`,
      [homeId],
    )
    expect(rows[0]?.id).toBeDefined()
  })
})

// ─── AT-13: dependency_assessments source='imported_from_carestream' ──────────

describe('AT-13 — dependency_assessments stores CareStream provenance', () => {
  let residentId: string

  beforeAll(async () => {
    // Disable FK checks so we don't need a real auth.users row
    const client = await pool.connect()
    try {
      await client.query(`SET session_replication_role = 'replica'`)
      const { rows: [r] } = await client.query<{ id: string }>(
        `INSERT INTO public.residents
           (tenant_id, home_id, first_name, source, external_resident_ref)
         VALUES ($1, $1, 'Test', 'imported_from_carestream', 'CS-AT13-001')
         RETURNING id`,
        [homeId],
      )
      residentId = r.id
    } finally {
      await client.query(`SET session_replication_role = 'origin'`)
      client.release()
    }
  })

  it('can insert a dependency_assessment with source=imported_from_carestream', async () => {
    const client = await pool.connect()
    try {
      await client.query(`SET session_replication_role = 'replica'`)
      const { rows } = await client.query<{ source: string }>(
        `INSERT INTO public.dependency_assessments
           (tenant_id, home_id, resident_id, external_resident_ref,
            source, assessment_date, overall_band,
            mobility_score, continence_score, cognition_score,
            behaviour_score, clinical_complexity_score)
         VALUES ($1, $1, $2, 'CS-AT13-001',
                 'imported_from_carestream', CURRENT_DATE, 'medium',
                 1, 0, 1, 0, 0)
         RETURNING source`,
        [homeId, residentId],
      )
      expect(rows[0]?.source).toBe('imported_from_carestream')
    } finally {
      await client.query(`SET session_replication_role = 'origin'`)
      client.release()
    }
  })

  it('source column accepts all three enum values', async () => {
    const { rows } = await query(
      `SELECT enumlabel FROM pg_enum
       JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
       WHERE pg_type.typname = 'dependency_source'`,
    )
    const labels = rows.map((r: { enumlabel: string }) => r.enumlabel)
    expect(labels).toContain('imported_from_carestream')
    expect(labels).toContain('carerota_native')
    expect(labels).toContain('manual_csv')
  })
})

// ─── AT-14: upsert guard — index supports dedup lookup ───────────────────────

describe('AT-14 — external_resident_ref dedup (application-enforced, index-supported)', () => {
  it('two residents with same external_resident_ref can be inserted (no DB UNIQUE constraint)', async () => {
    // The uniqueness is enforced by the application (SELECT-then-INSERT logic).
    // The DB provides a partial index for fast lookup — not a unique constraint.
    // This test documents that design decision.
    const client = await pool.connect()
    try {
      await client.query(`SET session_replication_role = 'replica'`)
      const { rowCount: first } = await client.query(
        `INSERT INTO public.residents
           (tenant_id, home_id, first_name, source, external_resident_ref)
         VALUES ($1, $1, 'Alice', 'imported_from_carestream', 'CS-AT14-DUP') RETURNING id`,
        [homeId],
      )
      const { rowCount: second } = await client.query(
        `INSERT INTO public.residents
           (tenant_id, home_id, first_name, source, external_resident_ref)
         VALUES ($1, $1, 'Alice', 'imported_from_carestream', 'CS-AT14-DUP') RETURNING id`,
        [homeId],
      )
      // DB allows it — dedup is the application's responsibility
      expect(first).toBe(1)
      expect(second).toBe(1)
    } finally {
      await client.query(`SET session_replication_role = 'origin'`)
      client.release()
    }
  })

  it('index on (home_id, external_resident_ref) allows efficient lookup', async () => {
    const { rows } = await query(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE tablename = 'residents' AND indexdef ILIKE '%external_resident_ref%'`,
    )
    expect(rows.length).toBeGreaterThan(0)
    // The partial index covers the WHERE external_resident_ref IS NOT NULL case
    const idx = rows[0] as { indexdef: string }
    expect(idx.indexdef).toMatch(/home_id/)
    expect(idx.indexdef).toMatch(/external_resident_ref/)
  })
})

// ─── Staffing matrix schema ───────────────────────────────────────────────────

describe('staffing_matrices schema', () => {
  it('can insert a matrix row and retrieve it', async () => {
    const { rows } = await query<{ shift_block: string; min_carers: number }>(
      `INSERT INTO public.staffing_matrices
         (tenant_id, home_id, shift_block, name, min_carers, min_senior_carers, min_nurses, min_ancillary)
       VALUES ($1, $1, 'morning', 'Standard morning', 5, 1, 0, 1)
       RETURNING shift_block, min_carers`,
      [homeId],
    )
    expect(rows[0]?.shift_block).toBe('morning')
    expect(rows[0]?.min_carers).toBe(5)
  })
})
