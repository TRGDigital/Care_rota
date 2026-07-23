'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function setHolidayUnit(
  homeId: string,
  unit: 'days' | 'hours',
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('homes')
    .update({ holiday_allocation_unit: unit })
    .eq('id', homeId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Permission denied — could not update this home. Check your account has manager access.' }
  }

  revalidatePath(`/homes/${homeId}/settings`)
  return undefined
}
