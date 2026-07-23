import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, RoleCode } from '@carerota/types'
import { OverrideError } from '@carerota/types'
import { OVERRIDE_AUTHORISATION } from './authorisation'

export type RecordOverrideParams = {
  homeId: string
  ruleCode: string
  entityType: string
  entityId: string
  blockedAction: string
  reasonCategory: string
  justification: string
  overriddenByUserId: string
  overriddenByRoles: RoleCode[]
  mfaMethod: 'password_reentry' | 'totp' | 'webauthn'
  beforeState?: unknown
  afterState?: unknown
}

export class RuleOverrideService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async recordOverride(params: RecordOverrideParams) {
    const auth = OVERRIDE_AUTHORISATION[params.ruleCode]

    if (!auth) {
      throw new OverrideError(
        'unknown_rule',
        `No override authorisation configured for rule: ${params.ruleCode}`,
      )
    }

    // Justification minimum length
    if (params.justification.trim().length < 20) {
      throw new OverrideError(
        'justification_too_short',
        'Justification must be at least 20 characters',
      )
    }

    // Role check
    const permitted = auth.rolesPermitted.some(r => params.overriddenByRoles.includes(r))
    if (!permitted) {
      throw new OverrideError(
        'role_not_permitted',
        `Role not permitted to override rule: ${params.ruleCode}`,
      )
    }

    const { data, error } = await this.supabase
      .from('rule_overrides')
      .insert({
        home_id:                params.homeId,
        tenant_id:              params.homeId,
        rule_code:              params.ruleCode,
        entity_type:            params.entityType,
        entity_id:              params.entityId,
        blocked_action:         params.blockedAction,
        reason_category:        params.reasonCategory,
        justification:          params.justification.trim(),
        overridden_by_user_id:  params.overriddenByUserId,
        mfa_method:             params.mfaMethod,
        before_state_json:      (params.beforeState ?? null) as never,
        after_state_json:       (params.afterState ?? null) as never,
      })
      .select()
      .single()

    if (error) {
      throw new OverrideError('db_error', error.message)
    }

    return data
  }
}
