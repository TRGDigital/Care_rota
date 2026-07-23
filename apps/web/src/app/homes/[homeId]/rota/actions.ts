'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createRotaPeriod } from '@carerota/domain/server'

export async function createPeriodAction(homeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const result = await createRotaPeriod(supabase as never, homeId, user.id)
  if (!result.success) return { error: result.error }

  revalidatePath(`/homes/${homeId}/rota`)
  redirect(`/homes/${homeId}/rota/${result.periodId}`)
}
