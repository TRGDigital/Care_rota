'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const BedSchema = z.object({
  room_number: z.string().min(1).max(20),
  capacity:    z.coerce.number().int().min(1).max(2),
  status:      z.enum(['vacant', 'occupied', 'reserved', 'maintenance']),
})

export async function addBed(homeId: string, formData: FormData) {
  const parsed = BedSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) throw new Error('Invalid bed data')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase.from('beds').insert({
    tenant_id:          homeId,
    home_id:            homeId,
    room_number:        parsed.data.room_number,
    capacity:           parsed.data.capacity,
    status:             parsed.data.status,
    created_by_user_id: user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/settings/beds`)
}

export async function editBed(homeId: string, bedId: string, formData: FormData) {
  const parsed = BedSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) throw new Error('Invalid bed data')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase.from('beds').update({
    room_number:        parsed.data.room_number,
    capacity:           parsed.data.capacity,
    status:             parsed.data.status,
    updated_by_user_id: user.id,
  }).eq('id', bedId).eq('home_id', homeId)

  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/settings/beds`)
}

export async function bulkImportBeds(homeId: string, rows: { room_number: string; capacity: number }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const inserts = rows.map(r => ({
    tenant_id:          homeId,
    home_id:            homeId,
    room_number:        r.room_number,
    capacity:           r.capacity,
    status:             'vacant' as const,
    created_by_user_id: user.id,
  }))

  const { error } = await supabase.from('beds').upsert(inserts, { onConflict: 'home_id,room_number' })
  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/settings/beds`)
}
