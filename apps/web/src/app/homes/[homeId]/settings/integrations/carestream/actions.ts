'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type CsvRow = {
  resident_external_ref: string
  first_name: string
  last_name_initial: string
  room_number: string
  dependency_band: string  // overall_band directly — CareStream provides the rolled-up band
  assessment_date: string
}

export type ImportResult = {
  created: number
  updated: number
  // AT-15: residents active in DB but absent from CSV — may have been discharged
  possiblyDischarged: { id: string; first_name: string; room_number: string | null; external_resident_ref: string }[]
}

export async function importCareStreamCsv(
  homeId: string,
  rows: CsvRow[],
): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  let created = 0
  let updated = 0

  // AT-15: fetch all currently-active imported residents for this home so we
  // can detect which ones are missing from the new CSV (possible discharges).
  const { data: activeImported } = await supabase
    .from('residents')
    .select('id, first_name, room_number, external_resident_ref')
    .eq('home_id', homeId)
    .eq('source', 'imported_from_carestream')
    .is('discharge_date', null)

  const incomingRefs = new Set(rows.map(r => r.resident_external_ref))

  for (const row of rows) {
    // Find existing resident by external_resident_ref (AT-14: no duplicates)
    const { data: existing } = await supabase
      .from('residents')
      .select('id')
      .eq('home_id', homeId)
      .eq('external_resident_ref', row.resident_external_ref)
      .maybeSingle()

    let residentId: string

    if (existing) {
      // Update existing resident
      await supabase.from('residents').update({
        first_name:          row.first_name,
        last_name_initial:   row.last_name_initial || null,
        room_number:         row.room_number || null,
        updated_by_user_id:  user.id,
      }).eq('id', existing.id)
      residentId = existing.id
      updated++
    } else {
      // Create new resident
      const { data: newResident, error } = await supabase
        .from('residents')
        .insert({
          tenant_id:             homeId,
          home_id:               homeId,
          source:                'imported_from_carestream',
          external_resident_ref: row.resident_external_ref,
          first_name:            row.first_name,
          last_name_initial:     row.last_name_initial || null,
          room_number:           row.room_number || null,
          created_by_user_id:    user.id,
        })
        .select('id')
        .single()

      if (error || !newResident) continue
      residentId = newResident.id
      created++
    }

    // Write dependency_assessment row with source = imported_from_carestream (AT-13)
    await supabase.from('dependency_assessments').insert({
      tenant_id:                 homeId,
      home_id:                   homeId,
      resident_id:               residentId,
      external_resident_ref:     row.resident_external_ref,
      source:                    'imported_from_carestream',
      assessed_by_user_id:       user.id,
      assessment_date:           row.assessment_date,
      overall_band:              row.dependency_band,
      // CareStream provides overall band; individual scores not available from CSV
      mobility_score:            0,
      continence_score:          0,
      cognition_score:           0,
      behaviour_score:           0,
      clinical_complexity_score: 0,
      created_by_user_id:        user.id,
    })
  }

  // AT-15: identify residents present in DB but absent from the new CSV
  const possiblyDischarged = (activeImported ?? []).filter(
    r => r.external_resident_ref && !incomingRefs.has(r.external_resident_ref),
  ) as ImportResult['possiblyDischarged']

  revalidatePath(`/homes/${homeId}/residents`)
  revalidatePath(`/homes/${homeId}/dashboards`)

  return { created, updated, possiblyDischarged }
}
