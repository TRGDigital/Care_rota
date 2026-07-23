'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { checkShiftEligibility, publishRotaPeriod, autoFillPeriod } from '@carerota/domain/server'
import { z } from 'zod'

const OverrideSchema = z.object({
  rule_code: z.string().min(1),
  reason_category: z.string().min(1),
  justification: z.string().min(20),
})

export async function assignShift(
  homeId: string,
  periodId: string,
  shiftId: string,
  staffId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  // Fetch shift details for eligibility check
  const { data: shift } = await supabase
    .from('shifts')
    .select('id, planned_start_utc, planned_end_utc, shift_slot_id')
    .eq('id', shiftId)
    .eq('home_id', homeId)
    .single()

  if (!shift) return { error: 'Shift not found' }

  const { data: slot } = await supabase
    .from('shift_slots')
    .select('id, date, shift_pattern_template_id, role_code')
    .eq('id', shift.shift_slot_id)
    .single()

  if (!slot) return { error: 'Slot not found' }

  // Run eligibility check
  const eligibility = await checkShiftEligibility(supabase as never, {
    homeId,
    staffId,
    shiftDate: slot.date,
    plannedStartUtc: shift.planned_start_utc,
    plannedEndUtc: shift.planned_end_utc,
    roleCode: slot.role_code,
    shiftTemplateId: slot.shift_pattern_template_id,
  })

  // Hard blocks with no-override path are absolute
  const absoluteBlock = eligibility.blocks.find(b => b.override_path === 'none')
  if (absoluteBlock) {
    return { error: absoluteBlock.message, blocked: true, blocks: eligibility.blocks }
  }

  // Return blocks/warnings for the UI to handle
  if (!eligibility.eligible) {
    return {
      blocked: true,
      blocks: eligibility.blocks,
      warnings: eligibility.warnings,
    }
  }

  // Assign the shift
  const { error } = await supabase
    .from('shifts')
    .update({
      staff_id: staffId,
      state: 'assigned',
      updated_by_user_id: user.id,
    })
    .eq('id', shiftId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }

  revalidatePath(`/homes/${homeId}/rota/${periodId}`)
  return { success: true, warnings: eligibility.warnings }
}

export async function assignShiftWithOverride(
  homeId: string,
  periodId: string,
  shiftId: string,
  staffId: string,
  formData: FormData
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = OverrideSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid override data' }

  // Write the rule_override record
  const { error: overrideError } = await supabase.from('rule_overrides').insert({
    home_id: homeId,
    tenant_id: homeId,
    rule_code: parsed.data.rule_code,
    entity_type: 'shift',
    entity_id: shiftId,
    blocked_action: 'assign_staff',
    reason_category: parsed.data.reason_category,
    justification: parsed.data.justification,
    overridden_by_user_id: user.id,
    mfa_method: 'password_reentry' as const, // simplified — full MFA in Sprint 4
  })

  if (overrideError) return { error: overrideError.message }

  // Assign the shift
  const { error } = await supabase
    .from('shifts')
    .update({ staff_id: staffId, state: 'assigned', updated_by_user_id: user.id })
    .eq('id', shiftId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }

  revalidatePath(`/homes/${homeId}/rota/${periodId}`)
  return { success: true }
}

export async function unassignShift(homeId: string, periodId: string, shiftId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { error } = await supabase
    .from('shifts')
    .update({ staff_id: null, state: 'unassigned', updated_by_user_id: user.id })
    .eq('id', shiftId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/rota/${periodId}`)
  return { success: true }
}

export async function publishPeriodAction(homeId: string, periodId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const result = await publishRotaPeriod(supabase as never, homeId, periodId, user.id)
  if (!result.success) return { error: result.error, blocks: 'blocks' in result ? result.blocks : undefined }

  revalidatePath(`/homes/${homeId}/rota/${periodId}`)
  revalidatePath(`/homes/${homeId}/rota`)
  return { success: true }
}

export async function getEligibleStaff(homeId: string, shiftId: string) {
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts')
    .select('planned_start_utc, planned_end_utc, shift_slot_id')
    .eq('id', shiftId)
    .single()

  if (!shift) return { error: 'Shift not found', staff: [] }

  const { data: slot } = await supabase
    .from('shift_slots')
    .select('date, shift_pattern_template_id, role_code')
    .eq('id', shift.shift_slot_id)
    .single()

  if (!slot) return { error: 'Slot not found', staff: [] }

  // Get all active staff for the home
  const { data: allStaff } = await supabase
    .from('staff')
    .select('id, first_name, last_name, employee_number')
    .eq('home_id', homeId)
    .eq('status', 'active')
    .order('last_name')

  if (!allStaff?.length) return { staff: [] }

  // Run eligibility checks in parallel (batched for performance)
  const results = await Promise.all(
    allStaff.map(async s => {
      const elig = await checkShiftEligibility(supabase as never, {
        homeId,
        staffId: s.id,
        shiftDate: slot.date,
        plannedStartUtc: shift.planned_start_utc,
        plannedEndUtc: shift.planned_end_utc,
        roleCode: slot.role_code,
        shiftTemplateId: slot.shift_pattern_template_id,
      })
      return {
        ...s,
        eligible: elig.eligible,
        blocks: elig.blocks,
        warnings: elig.warnings,
      }
    })
  )

  return { staff: results }
}

export async function autoFillPeriodAction(homeId: string, periodId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const result = await autoFillPeriod(supabase as never, homeId, periodId, user.id)
  if (!result.success) return { error: result.error }

  revalidatePath(`/homes/${homeId}/rota/${periodId}`)
  return { success: true, assigned: result.assigned, open: result.open }
}
