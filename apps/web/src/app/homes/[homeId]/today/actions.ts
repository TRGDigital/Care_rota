'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function confirmOccupancy(homeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Roll forward the latest snapshot to today
  const { data: latest } = await supabase
    .from('bed_occupancy_snapshots')
    .select('occupied_beds, vacant_beds')
    .eq('home_id', homeId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest) return

  await supabase.from('bed_occupancy_snapshots').insert({
    tenant_id:          homeId,
    home_id:            homeId,
    occupied_beds:      latest.occupied_beds,
    vacant_beds:        latest.vacant_beds,
    snapshot_at:        new Date().toISOString(),
    created_by_user_id: user.id,
  })

  revalidatePath(`/homes/${homeId}/today`)
}

const OccupancySchema = z.object({
  occupied_beds: z.coerce.number().int().min(0),
  vacant_beds:   z.coerce.number().int().min(0),
})

export async function updateOccupancy(homeId: string, formData: FormData) {
  const parsed = OccupancySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) throw new Error('Invalid occupancy data')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  await supabase.from('bed_occupancy_snapshots').insert({
    tenant_id:          homeId,
    home_id:            homeId,
    occupied_beds:      parsed.data.occupied_beds,
    vacant_beds:        parsed.data.vacant_beds,
    snapshot_at:        new Date().toISOString(),
    created_by_user_id: user.id,
  })

  revalidatePath(`/homes/${homeId}/today`)
}
