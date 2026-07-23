'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resetToEqualShares } from '@/lib/redistribute-weighting'

const LEAVE_YEAR_START = '2026-01-01'
const CONTRACT_TYPES = ['full_time', 'part_time', 'bank', 'zero_hours']

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// Unassign a staff member from every upcoming shift (today onwards) so a person taken off the rota
// (long-term sick, leaver) no longer appears; their shifts revert to unfilled gaps for cover.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function unassignUpcomingShifts(supabase: any, homeId: string, staffId: string, userId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: rows } = await supabase
    .from('shifts')
    .select('id, shift_slots!inner(date)')
    .eq('home_id', homeId)
    .eq('staff_id', staffId)
    .neq('state', 'cancelled')
    .gte('shift_slots.date', today)
  const ids = (rows ?? []).map((r: { id: string }) => r.id)
  if (ids.length === 0) return
  await supabase
    .from('shifts')
    .update({ staff_id: null, state: 'unassigned', updated_by_user_id: userId })
    .in('id', ids)
}

// Day / night / both.
export async function updateShiftType(homeId: string, staffId: string, shiftType: 'day' | 'night' | 'both') {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorised' }
  if (!['day', 'night', 'both'].includes(shiftType)) return { error: 'Invalid shift type' }
  const { error } = await supabase.from('staff')
    .update({ shift_type: shiftType, updated_by_user_id: user.id })
    .eq('id', staffId).eq('home_id', homeId)
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff`)
  return { ok: true }
}

// Contract type, plus "long_term_sick" which is really a status: it takes the person off the rota
// (auto-fill only takes active staff) and out of the overtime pool.
export async function updateContractStatus(homeId: string, staffId: string, value: string) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorised' }

  if (value === 'long_term_sick') {
    const { error } = await supabase.from('staff')
      .update({ status: 'long_term_sick', overtime_weighting: 0, updated_by_user_id: user.id })
      .eq('id', staffId).eq('home_id', homeId)
    if (error) return { error: error.message }
    await unassignUpcomingShifts(supabase, homeId, staffId, user.id) // pull them off the rota; gaps show for cover
    await resetToEqualShares(supabase, homeId, user.id) // others absorb their share
    revalidatePath(`/homes/${homeId}/staff`)
    return { ok: true }
  }

  if (!CONTRACT_TYPES.includes(value)) return { error: 'Invalid contract type' }

  // Reactivate if they were off, and set the contract type on their latest contract.
  const { error: stErr } = await supabase.from('staff')
    .update({ status: 'active', updated_by_user_id: user.id })
    .eq('id', staffId).eq('home_id', homeId)
  if (stErr) return { error: stErr.message }

  const { data: contract } = await supabase.from('staff_contracts')
    .select('id').eq('staff_id', staffId).eq('home_id', homeId)
    .order('effective_from', { ascending: false }).limit(1).maybeSingle()
  if (contract?.id) {
    await supabase.from('staff_contracts')
      .update({ contract_type: value as never, updated_by_user_id: user.id })
      .eq('id', contract.id)
  }
  await resetToEqualShares(supabase, homeId, user.id) // returning to active may re-add them
  revalidatePath(`/homes/${homeId}/staff`)
  return { ok: true }
}

// Contracted hours per week (updates the latest contract, or creates one if somehow missing).
export async function updateContractedHours(homeId: string, staffId: string, hours: number) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorised' }
  const h = Math.max(0, Number(hours) || 0)

  const { data: contract } = await supabase.from('staff_contracts')
    .select('id').eq('staff_id', staffId).eq('home_id', homeId)
    .order('effective_from', { ascending: false }).limit(1).maybeSingle()

  if (contract?.id) {
    const { error } = await supabase.from('staff_contracts')
      .update({ contracted_hours_per_week: h, updated_by_user_id: user.id })
      .eq('id', contract.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('staff_contracts').insert({
      tenant_id: homeId, home_id: homeId, staff_id: staffId,
      contract_type: 'part_time', contracted_hours_per_week: h,
      shift_pattern_preference: 'any', effective_from: '2026-01-01', created_by_user_id: user.id,
    })
    if (error) return { error: error.message }
  }
  revalidatePath(`/homes/${homeId}/staff`)
  return { ok: true }
}

// Delete a staff member. Their setup (contracts, pay rates, fixed shifts, leave, documents,
// training) is removed, but the delete is refused if they have real payroll or attendance
// history — those records must be preserved, so mark such staff as Left instead.
export async function deleteStaff(homeId: string, staffId: string) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorised' }

  const historyTables = ['payslips', 'shifts_payable', 'shifts_actual', 'shift_clockings', 'statutory_payment_records'] as const
  for (const t of historyTables) {
    const { count } = await supabase.from(t as never).select('*', { count: 'exact', head: true }).eq('staff_id', staffId)
    if (count && count > 0) {
      return { error: "This staff member has payroll or attendance history, so can't be deleted. Set their contract to Long-term sick, or mark them as Left, instead." }
    }
  }

  // Remove the RESTRICT-guarded setup rows first (the rest cascade / set null on staff delete).
  for (const t of ['staff_pay_rates', 'staff_contracts', 'leave_requests', 'sickness_episodes'] as const) {
    await supabase.from(t).delete().eq('staff_id', staffId).eq('home_id', homeId)
  }

  const { error } = await supabase.from('staff').delete().eq('id', staffId).eq('home_id', homeId)
  if (error) return { error: error.message }

  await resetToEqualShares(supabase, homeId, user.id) // one fewer in the overtime pool
  revalidatePath(`/homes/${homeId}/staff`)
  return { ok: true }
}

// Specialist / champion roles a staff member holds (multi-select).
export async function updateSpecialisms(homeId: string, staffId: string, specialisms: string[]) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorised' }
  const clean = Array.isArray(specialisms) ? [...new Set(specialisms.map(String).filter(Boolean))] : []
  const { error } = await supabase.from('staff')
    .update({ specialisms: clean, updated_by_user_id: user.id })
    .eq('id', staffId).eq('home_id', homeId)
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff`)
  return { ok: true }
}

// Manually set annual-leave entitlement / taken (hours). Creates the balance row if missing so the
// staff whose names didn't match the holiday import can be filled in by hand.
export async function updateLeave(homeId: string, staffId: string, entitlement: number, taken: number) {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'Unauthorised' }
  const ent = Math.max(0, Number(entitlement) || 0)
  const tkn = Math.max(0, Number(taken) || 0)

  const { data: existing } = await supabase.from('leave_balances')
    .select('id').eq('home_id', homeId).eq('staff_id', staffId).eq('leave_year_start', LEAVE_YEAR_START)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase.from('leave_balances')
      .update({ entitlement_value: ent, taken_value: tkn, updated_by_user_id: user.id })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('leave_balances').insert({
      tenant_id: homeId, home_id: homeId, staff_id: staffId,
      leave_year_start: LEAVE_YEAR_START, allocation_unit: 'hours',
      entitlement_value: ent, taken_value: tkn, created_by_user_id: user.id,
    })
    if (error) return { error: error.message }
  }
  revalidatePath(`/homes/${homeId}/staff`)
  return { ok: true }
}
