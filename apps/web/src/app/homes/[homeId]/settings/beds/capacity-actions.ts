'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Set the home's total bed count (capacity) directly, without configuring each bed. This is the
// number the occupancy engine uses to scale staffing.
export async function saveBedCapacity(homeId: string, capacity: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const n = Math.round(Number(capacity))
  if (!Number.isFinite(n) || n < 1 || n > 2000) return { error: 'Enter a number between 1 and 2000' }

  const { error } = await supabase
    .from('homes')
    .update({ bed_capacity: n, updated_by_user_id: user.id })
    .eq('id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/beds`)
  return { ok: true }
}
