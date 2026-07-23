'use server'

import { createClient } from '@/lib/supabase/server'

export async function markPhotoReviewed(
  homeId: string,
  clockingId: string,
  flagged: boolean,
  flagReason: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('shift_clockings')
    .update({
      reviewed_at:          now,
      reviewed_by_user_id:  user.id,
      requires_review:      flagged,
      updated_at:           now,
      updated_by_user_id:   user.id,
    })
    .eq('id', clockingId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }

  if (flagged && flagReason) {
    // Fetch tenant_id for the audit row
    const { data: clocking } = await supabase
      .from('shift_clockings')
      .select('tenant_id')
      .eq('id', clockingId)
      .single()

    if (clocking) {
      await supabase
        .from('audit_events')
        .insert({
          tenant_id:        clocking.tenant_id,
          home_id:          homeId,
          actor_user_id:    user.id,
          action_code:      'punch_photo_flagged',
          entity_type:      'shift_clockings',
          entity_id:        clockingId,
          after_state_json: { reason: flagReason },
        })
    }
  }

  return {}
}
