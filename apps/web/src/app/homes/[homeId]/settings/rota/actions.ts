'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RotaConfigSchema = z.object({
  rota_period_weeks: z.coerce.number().int().refine(v => [1, 2, 4].includes(v), 'Must be 1, 2, or 4'),
  rota_start_day: z.coerce.number().int().min(0).max(6),
})

export async function saveRotaConfig(homeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = RotaConfigSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid' }

  const { error } = await supabase
    .from('homes')
    .update({ ...parsed.data, updated_by_user_id: user.id })
    .eq('id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/rota`)
  return { success: true }
}

const SlotReqSchema = z.object({
  // '' / 'all' → applies to every day (stored as NULL); otherwise a specific weekday 0–6.
  day_of_week: z.preprocess(
    v => (v === '' || v == null || v === 'all' ? null : Number(v)),
    z.number().int().min(0).max(6).nullable()
  ),
  shift_pattern_template_id: z.string().uuid(),
  role_code: z.string().min(1).max(50),
  headcount_required: z.coerce.number().int().min(1).max(20),
})

export async function addSlotRequirement(homeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = SlotReqSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid' }

  const { error } = await supabase.from('rota_slot_requirements').insert({
    home_id: homeId,
    tenant_id: homeId,
    created_by_user_id: user.id,
    ...parsed.data,
  })

  if (error) {
    if (error.code === '23505') return { error: 'A rule for that role, pattern and day already exists.' }
    return { error: error.message }
  }
  revalidatePath(`/homes/${homeId}/settings/rota`)
  return { success: true }
}

export async function deleteSlotRequirement(homeId: string, reqId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { error } = await supabase
    .from('rota_slot_requirements')
    .delete()
    .eq('id', reqId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/rota`)
  return { success: true }
}
