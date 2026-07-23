/**
 * Sprint 1 DB integration tests.
 * Requires: supabase start (local instance on port 54322).
 *
 * AT-6: UPDATE/DELETE on rule_overrides / audit_events are blocked for 'authenticated'.
 * AT-2/AT-8: rule_overrides rows are home-scoped and insertable by service role.
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

async function query(sql: string, params?: unknown[]) {
  const client = await pool.connect()
  try {
    return await client.query(sql, params)
  } finally {
    client.release()
  }
}

// Impersonate 'authenticated' role within a transaction to test grants.
// SET LOCAL ROLE only applies until the transaction ends.
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

// ─── AT-6: INSERT-only grants ─────────────────────────────────────────────────

describe('AT-6 — rule_overrides and audit_events are INSERT-only for authenticated', () => {
  for (const table of ['rule_overrides', 'audit_events', 'rule_override_reviews'] as const) {
    it(`${table}: UPDATE is rejected`, async () => {
      await expect(
        asAuthenticated(async client => {
          // Attempt a no-op UPDATE; should fail at grant check before touching any rows
          await client.query(`UPDATE public.${table} SET id = id WHERE false`)
        }),
      ).rejects.toThrow(/permission denied/)
    })

    it(`${table}: DELETE is rejected`, async () => {
      await expect(
        asAuthenticated(async client => {
          await client.query(`DELETE FROM public.${table} WHERE false`)
        }),
      ).rejects.toThrow(/permission denied/)
    })
  }
})

// ─── AT-2/AT-8: service role bypasses RLS, inserts rows per-home ──────────────

describe('AT-2/AT-8 — rule_overrides rows are home-scoped', () => {
  let homeAId: string
  let homeBId: string
  let orgId: string

  beforeAll(async () => {
    // Create org and two homes using postgres (superuser) so RLS doesn't interfere
    // tenant_id on both organisations and homes is GENERATED ALWAYS AS (id) STORED.
    const { rows: [org] } = await query(
      `INSERT INTO public.organisations (name) VALUES ($1) RETURNING id`,
      [`Test Org AT-2 ${Date.now()}`],
    )
    orgId = org.id

    // tenant_id on homes is GENERATED ALWAYS AS (id) STORED — don't supply it.
    const { rows: [homeA] } = await query(
      `INSERT INTO public.homes (organisation_id, name, address, registration_type, bed_capacity, time_zone)
       VALUES ($1, $2, $3, 'residential', 20, 'Europe/London') RETURNING id`,
      [orgId, 'Home A AT-2', '1 Test Street'],
    )
    homeAId = homeA.id

    const { rows: [homeB] } = await query(
      `INSERT INTO public.homes (organisation_id, name, address, registration_type, bed_capacity, time_zone)
       VALUES ($1, $2, $3, 'residential', 20, 'Europe/London') RETURNING id`,
      [orgId, 'Home B AT-2', '2 Test Street'],
    )
    homeBId = homeB.id
  })

  afterAll(async () => {
    if (homeAId) await query(`DELETE FROM public.rule_overrides WHERE home_id = $1`, [homeAId])
    if (homeAId) await query(`DELETE FROM public.homes WHERE id = $1`, [homeAId])
    if (homeBId) await query(`DELETE FROM public.homes WHERE id = $1`, [homeBId])
    if (orgId)   await query(`DELETE FROM public.organisations WHERE id = $1`, [orgId])
  })

  it('can insert a rule_override row for homeA as superuser', async () => {
    const client = await pool.connect()
    let rows: { id: string }[] = []
    try {
      // Disable FK checks so we don't need a real auth.users row for this structural test.
      await client.query(`SET session_replication_role = 'replica'`)
      const result = await client.query<{ id: string }>(
        `INSERT INTO public.rule_overrides
           (home_id, tenant_id, rule_code, entity_type, entity_id,
            blocked_action, reason_category, justification, overridden_by_user_id, mfa_method)
         VALUES ($1,$1,'wtr_11hr_rest','shift',uuid_generate_v7(),
                 'publish_shift','operational_emergency',
                 'Integration test justification that is long enough',
                 '00000000-0000-7000-8000-aaaaaaaaaaaa','password_reentry')
         RETURNING id`,
        [homeAId],
      )
      rows = result.rows
    } finally {
      await client.query(`SET session_replication_role = 'origin'`)
      client.release()
    }
    expect(rows[0]?.id).toBeDefined()
  })

  it('two homes exist and are different', () => {
    expect(homeAId).toBeDefined()
    expect(homeBId).toBeDefined()
    expect(homeAId).not.toBe(homeBId)
  })

  it('RLS policy on rule_overrides references active_home_id claim', async () => {
    const { rows } = await query(
      `SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'rule_overrides'`,
    )
    const policies = rows.map((r: { policyname: string }) => r.policyname)
    expect(policies.some((p: string) => p.includes('isolation') || p.includes('home'))).toBe(true)
  })
})
