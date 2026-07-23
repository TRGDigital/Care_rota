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
