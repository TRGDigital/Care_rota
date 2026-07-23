'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const MatrixSchema = z.object({
  shift_block:       z.enum(['morning', 'afternoon', 'night', 'long_day']),
  name:              z.string().min(1).max(100),
  min_carers:        z.coerce.number().int().min(0),
  min_senior_carers: z.coerce.number().int().min(0),
  min_nurses:        z.coerce.number().int().min(0),
  min_ancillary:     z.coerce.number().int().min(0),
})

export async function addMatrixRow(homeId: string, formData: FormData) {
  const parsed = MatrixSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) throw new Error('Invalid matrix data')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase.from('staffing_matrices').insert({
    tenant_id:          homeId,
    home_id:            homeId,
    shift_block:        parsed.data.shift_block,
    name:               parsed.data.name,
    min_carers:         parsed.data.min_carers,
    min_senior_carers:  parsed.data.min_senior_carers,
    min_nurses:         parsed.data.min_nurses,
    min_ancillary:      parsed.data.min_ancillary,
    created_by_user_id: user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/settings/staffing-matrix`)
}

export async function editMatrixRow(homeId: string, matrixId: string, formData: FormData) {
  const parsed = MatrixSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) throw new Error('Invalid matrix data')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase.from('staffing_matrices').update({
    shift_block:        parsed.data.shift_block,
    name:               parsed.data.name,
    min_carers:         parsed.data.min_carers,
    min_senior_carers:  parsed.data.min_senior_carers,
    min_nurses:         parsed.data.min_nurses,
    min_ancillary:      parsed.data.min_ancillary,
    updated_by_user_id: user.id,
  }).eq('id', matrixId).eq('home_id', homeId)

  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/settings/staffing-matrix`)
}
