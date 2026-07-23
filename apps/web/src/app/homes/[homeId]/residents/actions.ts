'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { computeDependencyBand } from '@carerota/domain'

const ResidentSchema = z.object({
  first_name:        z.string().min(1).max(100),
  last_name_initial: z.string().max(1).optional(),
  room_number:       z.string().max(20).optional(),
  admission_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:             z.string().max(1000).optional(),
})

export async function addResident(homeId: string, formData: FormData) {
  const parsed = ResidentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) throw new Error('Invalid form data')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase.from('residents').insert({
    tenant_id:         homeId,
    home_id:           homeId,
    source:            'carerota_native',
    first_name:        parsed.data.first_name,
    last_name_initial: parsed.data.last_name_initial ?? null,
    room_number:       parsed.data.room_number ?? null,
    admission_date:    parsed.data.admission_date ?? null,
    notes:             parsed.data.notes ?? null,
    created_by_user_id: user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/residents`)
}

export async function editResident(homeId: string, residentId: string, formData: FormData) {
  const parsed = ResidentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) throw new Error('Invalid form data')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase.from('residents').update({
    first_name:          parsed.data.first_name,
    last_name_initial:   parsed.data.last_name_initial ?? null,
    room_number:         parsed.data.room_number ?? null,
    admission_date:      parsed.data.admission_date ?? null,
    notes:               parsed.data.notes ?? null,
    updated_by_user_id:  user.id,
  }).eq('id', residentId).eq('home_id', homeId)

  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/residents`)
}

export async function dischargeResident(homeId: string, residentId: string, dischargeDate: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase.from('residents').update({
    discharge_date:     dischargeDate,
    updated_by_user_id: user.id,
  }).eq('id', residentId).eq('home_id', homeId)

  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/residents`)
}

const AssessmentSchema = z.object({
  mobility_score:            z.coerce.number().int().min(0).max(3),
  continence_score:          z.coerce.number().int().min(0).max(3),
  cognition_score:           z.coerce.number().int().min(0).max(3),
  behaviour_score:           z.coerce.number().int().min(0).max(3),
  clinical_complexity_score: z.coerce.number().int().min(0).max(3),
  assessment_date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function recordAssessment(homeId: string, residentId: string, formData: FormData) {
  const parsed = AssessmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) throw new Error('Invalid assessment data')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const scores = parsed.data
  const overall_band = computeDependencyBand(scores)

  const { error } = await supabase.from('dependency_assessments').insert({
    tenant_id:                 homeId,
    home_id:                   homeId,
    resident_id:               residentId,
    source:                    'carerota_native',
    assessed_by_user_id:       user.id,
    assessment_date:           scores.assessment_date,
    mobility_score:            scores.mobility_score,
    continence_score:          scores.continence_score,
    cognition_score:           scores.cognition_score,
    behaviour_score:           scores.behaviour_score,
    clinical_complexity_score: scores.clinical_complexity_score,
    overall_band,
    created_by_user_id:        user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/homes/${homeId}/residents/${residentId}`)
}
