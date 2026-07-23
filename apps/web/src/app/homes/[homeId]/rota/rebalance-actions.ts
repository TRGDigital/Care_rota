'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function dismissSuggestion(homeId: string, suggestionId: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { error } = await supabase
    .from('rebalance_suggestions')
    .update({
      status: 'dismissed',
      dismissed_reason: reason || 'Dismissed by manager',
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: user.id,
    })
    .eq('id', suggestionId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/rota`)
  return { success: true }
}

export async function approveSuggestion(homeId: string, suggestionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { error } = await supabase
    .from('rebalance_suggestions')
    .update({
      status: 'approved',
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: user.id,
    })
    .eq('id', suggestionId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/rota`)
  return { success: true }
}
