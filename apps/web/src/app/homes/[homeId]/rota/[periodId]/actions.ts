'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { checkShiftEligibility, publishRotaPeriod, autoFillPeriod, captureBaseWeek, generateHorizon, recommendRotaChanges } from '@carerota/domain/server'
import Anthropic from '@anthropic-ai/sdk'
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

// ── Time-block editing ────────────────────────────────────────────────────────
// Managers can adjust an existing block's times or add a new block, on BOTH draft and
// published rotas. Times are wall-clock (HH:MM) in the home's local day; we store them as
// UTC-naive timestamps the same way the generator does, so display round-trips cleanly.

const TimeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')
const TimingSchema = z.object({
  start_local: TimeStr,
  end_local: TimeStr,
  break_minutes: z.coerce.number().int().min(0).max(600),
})

function buildTimes(date: string, startLocal: string, endLocal: string, breakMinutes: number) {
  const [sh, sm] = startLocal.split(':').map(Number) as [number, number]
  const [eh, em] = endLocal.split(':').map(Number) as [number, number]
  const startMin = sh * 60 + sm
  let endMin = eh * 60 + em
  let endDate = date
  if (endMin <= startMin) {
    endMin += 24 * 60 // overnight → end rolls to the next day
    const d = new Date(`${date}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    endDate = d.toISOString().slice(0, 10)
  }
  const paidHours = Math.max(0, Math.round((endMin - startMin - breakMinutes) / 0.6) / 100)
  return {
    startUtc: `${date}T${startLocal}:00.000Z`,
    endUtc: `${endDate}T${endLocal}:00.000Z`,
    paidHours,
  }
}

export async function updateShiftTiming(
  homeId: string,
  periodId: string,
  shiftId: string,
  raw: { start_local: string; end_local: string; break_minutes: number }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = TimingSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid times' }

  const { data: shift } = await supabase
    .from('shifts')
    .select('shift_slot_id')
    .eq('id', shiftId)
    .eq('home_id', homeId)
    .single()
  if (!shift) return { error: 'Shift not found' }

  const { data: slot } = await supabase
    .from('shift_slots')
    .select('date')
    .eq('id', shift.shift_slot_id)
    .single()
  if (!slot) return { error: 'Slot not found' }

  const { startUtc, endUtc, paidHours } = buildTimes(
    slot.date, parsed.data.start_local, parsed.data.end_local, parsed.data.break_minutes
  )

  const { error } = await supabase
    .from('shifts')
    .update({
      planned_start_utc: startUtc,
      planned_end_utc: endUtc,
      planned_break_minutes: parsed.data.break_minutes,
      planned_paid_hours: paidHours,
      updated_by_user_id: user.id,
    })
    .eq('id', shiftId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/rota/${periodId}`)
  return { success: true, paidHours }
}

export async function addShiftForStaff(
  homeId: string,
  periodId: string,
  staffId: string,
  date: string,
  templateId: string,
  raw: { start_local: string; end_local: string; break_minutes: number }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = TimingSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid times' }

  const { data: staff } = await supabase
    .from('staff')
    .select('role_code')
    .eq('id', staffId)
    .eq('home_id', homeId)
    .single()
  if (!staff) return { error: 'Staff not found' }

  const { data: tmpl } = await supabase
    .from('shift_pattern_templates')
    .select('id')
    .eq('id', templateId)
    .eq('home_id', homeId)
    .single()
  if (!tmpl) return { error: 'Shift pattern not found' }

  const { startUtc, endUtc, paidHours } = buildTimes(
    date, parsed.data.start_local, parsed.data.end_local, parsed.data.break_minutes
  )

  const slotId = crypto.randomUUID()
  const { error: slotError } = await supabase.from('shift_slots').insert({
    id: slotId,
    home_id: homeId,
    tenant_id: homeId,
    rota_period_id: periodId,
    date,
    shift_pattern_template_id: templateId,
    role_code: staff.role_code ?? 'care_assistant',
    headcount_required: 1,
    created_by_user_id: user.id,
  })
  if (slotError) return { error: slotError.message }

  const { error: shiftError } = await supabase.from('shifts').insert({
    home_id: homeId,
    tenant_id: homeId,
    shift_slot_id: slotId,
    staff_id: staffId,
    state: 'assigned',
    planned_start_utc: startUtc,
    planned_end_utc: endUtc,
    planned_break_minutes: parsed.data.break_minutes,
    planned_paid_hours: paidHours,
    created_by_user_id: user.id,
  })
  if (shiftError) return { error: shiftError.message }

  revalidatePath(`/homes/${homeId}/rota/${periodId}`)
  return { success: true }
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

// AI review: analyse the period and return grounded, read-only suggestions to cut overtime and use
// the PM shift better. Rate-limited per home to bound LLM spend.
const aiCallLog = new Map<string, number[]>()
function aiRateLimited(homeId: string, maxPerHour = 12): boolean {
  const now = Date.now()
  const recent = (aiCallLog.get(homeId) ?? []).filter(t => now - t < 3_600_000)
  if (recent.length >= maxPerHour) { aiCallLog.set(homeId, recent); return true }
  recent.push(now)
  aiCallLog.set(homeId, recent)
  return false
}

export async function aiRecommendAction(homeId: string, periodId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) return { error: 'AI is not configured yet (missing API key). Ask an admin to set ANTHROPIC_API_KEY.' }

  if (aiRateLimited(homeId)) return { error: 'Too many AI reviews in the last hour — please wait a little and try again.' }

  const anthropic = new Anthropic({ apiKey })
  try {
    const result = await recommendRotaChanges(supabase as never, anthropic, homeId, periodId)
    if (!result.success) return { error: result.error }
    return { success: true, suggestions: result.suggestions, snapshot: result.snapshot }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'AI review failed.' }
  }
}

// Apply a single AI suggestion: reassign one shift to an under-contract staff member. Everything is
// re-checked server-side (the shift must be in this period, the target active, eligibility must pass)
// so a stale or bad suggestion can't push through an invalid change.
const ReassignSchema = z.object({
  type: z.literal('reassign'),
  shift_id: z.string().uuid(),
  to_staff_id: z.string().uuid(),
})

export async function applyRotaSuggestionAction(
  homeId: string,
  periodId: string,
  change: { type: string; shift_id: string; to_staff_id: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = ReassignSchema.safeParse(change)
  if (!parsed.success) return { error: 'This suggestion can’t be applied automatically.' }
  const { shift_id, to_staff_id } = parsed.data

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, staff_id, planned_start_utc, planned_end_utc, shift_slot_id')
    .eq('id', shift_id).eq('home_id', homeId).single()
  if (!shift) return { error: 'That shift no longer exists.' }

  const { data: slot } = await supabase
    .from('shift_slots')
    .select('date, role_code, shift_pattern_template_id, rota_period_id')
    .eq('id', shift.shift_slot_id).single()
  if (!slot || slot.rota_period_id !== periodId) return { error: 'That shift is not in this rota.' }

  if (shift.staff_id === to_staff_id) return { error: 'Already assigned to that person.' }

  const { data: target } = await supabase
    .from('staff')
    .select('id, first_name, last_name, status')
    .eq('id', to_staff_id).eq('home_id', homeId).single()
  if (!target) return { error: 'Target staff not found.' }
  if (target.status !== 'active') return { error: `${target.first_name} ${target.last_name} is not active.` }

  const eligibility = await checkShiftEligibility(supabase as never, {
    homeId,
    staffId: to_staff_id,
    shiftDate: slot.date,
    plannedStartUtc: shift.planned_start_utc,
    plannedEndUtc: shift.planned_end_utc,
    roleCode: slot.role_code,
    shiftTemplateId: slot.shift_pattern_template_id,
  })
  if (!eligibility.eligible) {
    const reason = eligibility.blocks[0]?.message ?? 'blocked by a scheduling rule'
    return { error: `Can’t apply: ${target.first_name} is ${reason}. Adjust it on the rota instead.` }
  }

  const { error } = await supabase
    .from('shifts')
    .update({ staff_id: to_staff_id, state: 'assigned', updated_by_user_id: user.id })
    .eq('id', shift_id).eq('home_id', homeId)
  if (error) return { error: error.message }

  revalidatePath(`/homes/${homeId}/rota/${periodId}`)
  return {
    success: true,
    movedTo: `${target.first_name} ${target.last_name}`,
    warning: eligibility.warnings[0]?.message,
  }
}

// Lock this worked-on week in as the home's repeating base week, then roll it forward across the
// 6-month horizon. Future weeks repeat the same people on the same shifts, with leave and sickness
// applied per week and every week individually adjustable.
export async function createBaseWeekAction(homeId: string, periodId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const captured = await captureBaseWeek(supabase as never, homeId, periodId, user.id)
  if (!captured.success) return { error: captured.error }

  const horizon = await generateHorizon(supabase as never, homeId, user.id, { weeksAhead: 26 })

  revalidatePath(`/homes/${homeId}/rota`)
  revalidatePath(`/homes/${homeId}/rota/${periodId}`)
  return {
    success: true,
    patterns: captured.patternsWritten,
    periodsCreated: horizon.periodsCreated,
    shiftsPlaced: horizon.shiftsPreFilled + horizon.shiftsAssigned,
    error: horizon.errors[0],
  }
}
