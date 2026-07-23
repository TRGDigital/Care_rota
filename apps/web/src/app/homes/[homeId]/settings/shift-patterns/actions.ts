'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ShiftPatternSchema = z.object({
  name: z.string().min(1).max(100),
  start_time_local: z.string().regex(/^\d{2}:\d{2}$/),
  end_time_local: z.string().regex(/^\d{2}:\d{2}$/),
  break_minutes: z.coerce.number().int().min(0).max(120),
  paid_hours_decimal: z.coerce.number().min(0).max(24),
  length_type: z.enum(['long_day_12h', 'short_half_6h', 'sleep_in', 'custom']),
})

export async function createShiftPattern(homeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = ShiftPatternSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('shift_pattern_templates').insert({
    home_id: homeId,
    tenant_id: homeId,
    created_by_user_id: user.id,
    ...parsed.data,
  })

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/shift-patterns`)
  return { success: true }
}

export async function updateShiftPattern(homeId: string, patternId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = ShiftPatternSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('shift_pattern_templates')
    .update({ ...parsed.data, updated_by_user_id: user.id })
    .eq('id', patternId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/shift-patterns`)
  return { success: true }
}

export async function deleteShiftPattern(homeId: string, patternId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { error } = await supabase
    .from('shift_pattern_templates')
    .delete()
    .eq('id', patternId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/shift-patterns`)
  return { success: true }
}
