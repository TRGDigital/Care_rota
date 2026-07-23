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
