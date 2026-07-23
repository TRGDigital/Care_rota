'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@carerota/types'

type ReconciliationState = Database['public']['Enums']['reconciliation_state']
type MfaMethod = Database['public']['Enums']['mfa_method']

type NoShowAction     = 'pay_zero' | 'pay_planned'
type NoClockOutAction = 'pay_actual' | 'manual_out' | 'pay_zero' | 'pay_planned'

export async function resolveNoShow(
  homeId: string,
  shiftsActualId: string,
  opts: { action: NoShowAction; reason: string },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const now = new Date().toISOString()

  const { data: actual } = await supabase
    .from('shifts_actual')
    .select('shift_id, tenant_id, home_id')
    .eq('id', shiftsActualId)
    .eq('home_id', homeId)
    .single()

  if (!actual) return { error: 'record_not_found' }

  const newState: ReconciliationState = 'manual_override'

  const { error: actualErr } = await supabase
    .from('shifts_actual')
    .update({
      reconciliation_status: newState,
      last_reconciled_at:    now,
      updated_at:            now,
      updated_by_user_id:    user.id,
    })
    .eq('id', shiftsActualId)

  if (actualErr) return { error: actualErr.message }

  if (opts.action === 'pay_zero') {
    await supabase
      .from('shifts_payable')
      .update({
        reconciliation_state:      newState,
        source_rule:               'pay_zero_no_show',
        paid_minutes_weekday:      0,
        paid_minutes_weekend:      0,
        paid_minutes_bank_holiday: 0,
        paid_minutes_night:        0,
        paid_minutes_sleep_in:     0,
        paid_minutes_disturbed:    0,
        manager_override_reason:   opts.reason,
        updated_at:                now,
      })
      .eq('shift_id', actual.shift_id)
      .eq('home_id', homeId)
  } else {
    await supabase
      .from('shifts_payable')
      .update({
        reconciliation_state:    newState,
        source_rule:             'pay_planned_override',
        manager_override_reason: opts.reason,
        updated_at:              now,
      })
      .eq('shift_id', actual.shift_id)
      .eq('home_id', homeId)
  }

  await supabase
    .from('audit_events')
    .insert({
      tenant_id:      actual.tenant_id,
      home_id:        homeId,
      actor_user_id:  user.id,
      action_code:    'no_show_resolved',
      entity_type:    'shifts_actual',
      entity_id:      shiftsActualId,
      after_state_json: { action: opts.action, reason: opts.reason },
    })

  if (opts.action === 'pay_planned') {
    await supabase
      .from('rule_overrides')
      .insert({
        tenant_id:             actual.tenant_id,
        home_id:               homeId,
        overridden_by_user_id: user.id,
        rule_code:             'no_show_pay_planned',
        blocked_action:        'pay_planned_no_show',
        entity_type:           'shifts_actual',
        entity_id:             shiftsActualId,
        justification:         opts.reason,
        reason_category:       'operational',
        mfa_method:            'none' as MfaMethod,
      })
  }

  return {}
}

export async function resolveNoClockOut(
  homeId: string,
  shiftsActualId: string,
  opts: {
    action: NoClockOutAction
    clockOutUtc?: string
    reason: string
  },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const now = new Date().toISOString()
  const newState: ReconciliationState = 'manual_override'

  const { data: actual } = await supabase
    .from('shifts_actual')
    .select('shift_id, tenant_id, home_id, actual_start_utc')
    .eq('id', shiftsActualId)
    .eq('home_id', homeId)
    .single()

  if (!actual) return { error: 'record_not_found' }

  const { data: shift } = await supabase
    .from('shifts')
    .select('planned_end_utc')
    .eq('id', actual.shift_id)
    .single()

  if (!shift) return { error: 'shift_not_found' }

  const resolvedClockOut = opts.clockOutUtc ?? shift.planned_end_utc
  let workedMins: number | null = null

  if (actual.actual_start_utc) {
    workedMins = Math.max(
      0,
      Math.round(
        (new Date(resolvedClockOut).getTime() - new Date(actual.actual_start_utc).getTime()) / 60_000,
      ),
    )
  }

  // Build the actual update object with proper types
  if (opts.action === 'manual_out' || opts.action === 'pay_actual') {
    await supabase
      .from('shifts_actual')
      .update({
        reconciliation_status:  newState,
        actual_end_utc:         resolvedClockOut,
        actual_worked_minutes:  workedMins,
        last_reconciled_at:     now,
        updated_at:             now,
        updated_by_user_id:     user.id,
      })
      .eq('id', shiftsActualId)
  } else {
    await supabase
      .from('shifts_actual')
      .update({
        reconciliation_status: newState,
        last_reconciled_at:    now,
        updated_at:            now,
        updated_by_user_id:    user.id,
      })
      .eq('id', shiftsActualId)
  }

  const sourceRule = opts.action === 'pay_planned' ? 'pay_planned_override'
                   : opts.action === 'pay_zero'    ? 'pay_zero_no_show'
                   : 'manager_override'

  if (opts.action === 'pay_zero') {
    await supabase
      .from('shifts_payable')
      .update({
        reconciliation_state:      newState,
        source_rule:               sourceRule,
        paid_minutes_weekday:      0,
        paid_minutes_weekend:      0,
        paid_minutes_bank_holiday: 0,
        paid_minutes_night:        0,
        paid_minutes_sleep_in:     0,
        paid_minutes_disturbed:    0,
        manager_override_reason:   opts.reason,
        updated_at:                now,
      })
      .eq('shift_id', actual.shift_id)
      .eq('home_id', homeId)
  } else {
    await supabase
      .from('shifts_payable')
      .update({
        reconciliation_state:    newState,
        source_rule:             sourceRule,
        manager_override_reason: opts.reason,
        updated_at:              now,
      })
      .eq('shift_id', actual.shift_id)
      .eq('home_id', homeId)
  }

  await supabase
    .from('audit_events')
    .insert({
      tenant_id:        actual.tenant_id,
      home_id:          homeId,
      actor_user_id:    user.id,
      action_code:      'no_clock_out_resolved',
      entity_type:      'shifts_actual',
      entity_id:        shiftsActualId,
      after_state_json: { action: opts.action, clockOutUtc: resolvedClockOut, reason: opts.reason },
    })

  if (opts.action === 'pay_planned') {
    await supabase
      .from('rule_overrides')
      .insert({
        tenant_id:             actual.tenant_id,
        home_id:               homeId,
        overridden_by_user_id: user.id,
        rule_code:             'no_clock_out_pay_planned',
        blocked_action:        'pay_planned_no_clock_out',
        entity_type:           'shifts_actual',
        entity_id:             shiftsActualId,
        justification:         opts.reason,
        reason_category:       'operational',
        mfa_method:            'none' as MfaMethod,
      })
  }

  return {}
}
