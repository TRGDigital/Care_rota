'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function markOverridesReviewed(
  homeId: string,
  overrideIds: string[],
  periodStart: string,
  periodEnd: string,
  comments?: string,
) {
  if (!overrideIds.length) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase.from('rule_override_reviews').insert({
    tenant_id:             homeId,
    home_id:               homeId,
    reviewer_user_id:      user.id,
    override_ids_reviewed: overrideIds,
    period_start:          periodStart,
    period_end:            periodEnd,
    comments:              comments ?? null,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/compliance/override-log`)
}
