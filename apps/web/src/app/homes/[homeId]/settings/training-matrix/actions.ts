'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const DEFAULT_TOPICS: Array<{ code: string; name: string; renewal_interval_months: number; enforcement_mode: 'hard' | 'soft' }> = [
  { code: 'FIRE',       name: 'Fire safety',                         renewal_interval_months: 12, enforcement_mode: 'hard' },
  { code: 'MAN_HANDLE', name: 'Manual handling',                     renewal_interval_months: 12, enforcement_mode: 'hard' },
  { code: 'INFECTION',  name: 'Infection prevention & control',      renewal_interval_months: 12, enforcement_mode: 'hard' },
  { code: 'SAFEGUARD',  name: 'Safeguarding adults',                 renewal_interval_months: 12, enforcement_mode: 'hard' },
  { code: 'MED_ADMIN',  name: 'Medication administration',           renewal_interval_months: 12, enforcement_mode: 'hard' },
  { code: 'FIRST_AID',  name: 'First aid',                          renewal_interval_months: 36, enforcement_mode: 'soft' },
  { code: 'DEMENTIA',   name: 'Dementia awareness',                  renewal_interval_months: 24, enforcement_mode: 'soft' },
  { code: 'FOOD_HYG',   name: 'Food hygiene',                       renewal_interval_months: 36, enforcement_mode: 'soft' },
]

const TopicSchema = z.object({
  code: z.string().min(1).max(20).transform(v => v.toUpperCase()),
  name: z.string().min(1).max(200),
  renewal_interval_months: z.coerce.number().int().min(1).max(120),
  enforcement_mode: z.enum(['hard', 'soft']),
})

export async function seedDefaultTopics(homeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { error } = await supabase
    .from('training_topics')
    .upsert(
      DEFAULT_TOPICS.map(t => ({ ...t, home_id: homeId, tenant_id: homeId, created_by_user_id: user.id })),
      { onConflict: 'home_id,code', ignoreDuplicates: true }
    )

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/training-matrix`)
  return { success: true }
}

export async function createTopic(homeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = TopicSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('training_topics').insert({
    home_id: homeId,
    tenant_id: homeId,
    created_by_user_id: user.id,
    ...parsed.data,
  })

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/training-matrix`)
  return { success: true }
}

export async function deleteTopic(homeId: string, topicId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { error } = await supabase
    .from('training_topics')
    .delete()
    .eq('id', topicId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/training-matrix`)
  return { success: true }
}
