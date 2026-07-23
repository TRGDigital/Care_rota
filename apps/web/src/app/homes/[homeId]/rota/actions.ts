'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createRotaPeriod, generateHorizon } from '@carerota/domain/server'

export async function createPeriodAction(homeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const result = await createRotaPeriod(supabase as never, homeId, user.id)
  if (!result.success) return { error: result.error }

  revalidatePath(`/homes/${homeId}/rota`)
  redirect(`/homes/${homeId}/rota/${result.periodId}`)
}

// Delete a draft rota period (and its slots/shifts). Published periods can't be deleted.
export async function deletePeriodAction(homeId: string, periodId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: period } = await supabase.from('rota_periods').select('status').eq('id', periodId).eq('home_id', homeId).maybeSingle()
  if (!period) return { error: 'Rota not found' }
  if (period.status !== 'draft') return { error: 'Only draft rotas can be deleted.' }

  const { data: slots } = await supabase.from('shift_slots').select('id').eq('rota_period_id', periodId)
  const slotIds = (slots ?? []).map((s: { id: string }) => s.id)
  if (slotIds.length) await supabase.from('shifts').delete().in('shift_slot_id', slotIds)

  const { error } = await supabase.from('rota_periods').delete().eq('id', periodId).eq('home_id', homeId)
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/rota`)
  return { ok: true }
}

// Generate (create + auto-fill) the next 6 months of rota periods in one go, off the standard
// week template and fixed patterns. Safe to re-run — it extends from the last existing period.
export async function generateHorizonAction(homeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const result = await generateHorizon(supabase as never, homeId, user.id, { weeksAhead: 26 })
  revalidatePath(`/homes/${homeId}/rota`)
  return {
    ok: true,
    periodsCreated: result.periodsCreated,
    shiftsPreFilled: result.shiftsPreFilled,
    shiftsAssigned: result.shiftsAssigned,
    error: result.errors[0] ?? null,
  }
}
