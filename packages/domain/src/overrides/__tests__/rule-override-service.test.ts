import { describe, it, expect, vi } from 'vitest'
import { RuleOverrideService } from '../rule-override-service'
import { OverrideError } from '@carerota/types'

const HOME_ID = '00000000-0000-7000-8000-000000000001'
const USER_ID = '00000000-0000-7000-8000-000000000002'
const SHIFT_ID = '00000000-0000-7000-8000-000000000003'

function makeSupabase(insertResult: { data: unknown; error: null } | { data: null; error: { message: string } }) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(insertResult),
        }),
      }),
    }),
  } as unknown as Parameters<typeof RuleOverrideService>[0]
}

const validParams = {
  homeId: HOME_ID,
  ruleCode: 'wtr_11hr_rest',
  entityType: 'shift',
  entityId: SHIFT_ID,
  blockedAction: 'publish_shift',
  reasonCategory: 'operational_emergency',
  justification: 'Short-staffed due to emergency absence — no cover available at short notice',
  overriddenByUserId: USER_ID,
  overriddenByRoles: ['registered_manager'] as const,
  mfaMethod: 'password_reentry' as const,
}

// Acceptance test 4 (partial): domain-level validation — MFA method is required on the params object.
// The API route is responsible for verifying the MFA proof before calling the service;
// the service records whichever method was confirmed.
describe('RuleOverrideService', () => {
  it('AT-5: writes a rule_overrides row when all params are valid', async () => {
    const inserted = { id: 'abc', ...validParams }
    const supabase = makeSupabase({ data: inserted, error: null })
    const svc = new RuleOverrideService(supabase as never)

    const result = await svc.recordOverride(validParams)

    expect(supabase.from).toHaveBeenCalledWith('rule_overrides')
    expect(result).toMatchObject({ id: 'abc' })
  })

  it('AT-4a: rejects if justification is too short (< 20 chars)', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'unused' } })
    const svc = new RuleOverrideService(supabase as never)

    await expect(svc.recordOverride({ ...validParams, justification: 'too short' }))
      .rejects.toBeInstanceOf(OverrideError)
  })

  it('AT-4b: rejects if the caller\'s role is not permitted for this rule', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'unused' } })
    const svc = new RuleOverrideService(supabase as never)

    await expect(
      svc.recordOverride({ ...validParams, overriddenByRoles: ['care_worker'] as never }),
    ).rejects.toBeInstanceOf(OverrideError)
  })

  it('rejects an unknown rule code', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'unused' } })
    const svc = new RuleOverrideService(supabase as never)

    await expect(
      svc.recordOverride({ ...validParams, ruleCode: 'nonexistent_rule' }),
    ).rejects.toMatchObject({ code: 'unknown_rule' })
  })

  it('propagates a Supabase insert error as OverrideError', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'permission denied' } })
    const svc = new RuleOverrideService(supabase as never)

    await expect(svc.recordOverride(validParams)).rejects.toMatchObject({ code: 'db_error' })
  })

  it('deputy_manager can override wtr_11hr_rest but not wtr_48hr_weekly', async () => {
    const supabase = makeSupabase({ data: { id: 'x' }, error: null })
    const svc = new RuleOverrideService(supabase as never)

    // deputy_manager IS permitted for wtr_11hr_rest
    await expect(
      svc.recordOverride({ ...validParams, ruleCode: 'wtr_11hr_rest', overriddenByRoles: ['deputy_manager'] as never }),
    ).resolves.toBeDefined()

    // deputy_manager is NOT permitted for wtr_48hr_weekly
    await expect(
      svc.recordOverride({ ...validParams, ruleCode: 'wtr_48hr_weekly', overriddenByRoles: ['deputy_manager'] as never }),
    ).rejects.toBeInstanceOf(OverrideError)
  })
})
