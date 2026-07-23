'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

function poundsToP(v: number) { return Math.round(v * 100) }

// ── Contracts ─────────────────────────────────────────────────────────────────

const ContractSchema = z.object({
  contract_type: z.enum(['full_time', 'part_time', 'bank', 'zero_hours']),
  contracted_hours_per_week: z.coerce.number().min(0).max(168),
  shift_pattern_preference: z.enum(['any', 'day_only', 'night_only', 'days_and_nights', 'early_only', 'late_only', 'no_nights', 'no_weekends', 'fixed']).default('any'),
  holiday_entitlement_value: z.coerce.number().min(0),
  effective_from: z.string(),
  effective_to: z.string().optional(),
})

export async function addContract(homeId: string, staffId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = ContractSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('staff_contracts').insert({
    home_id: homeId, tenant_id: homeId, staff_id: staffId,
    ...parsed.data,
    effective_to: parsed.data.effective_to || null,
    created_by_user_id: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

export async function updateContract(homeId: string, staffId: string, contractId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = ContractSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('staff_contracts')
    .update({ ...parsed.data, effective_to: parsed.data.effective_to || null, updated_by_user_id: user.id })
    .eq('id', contractId).eq('home_id', homeId).eq('staff_id', staffId)
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

// ── Pay rates ─────────────────────────────────────────────────────────────────

const PayRateSchema = z.object({
  role_code: z.string().min(1).max(50),
  rate_weekday:   z.coerce.number().min(0),
  rate_weekend:   z.coerce.number().min(0),
  rate_night:     z.coerce.number().min(0),
  rate_overtime:  z.coerce.number().min(0),
  rate_training:  z.coerce.number().min(0),
  rate_sleep_in:  z.coerce.number().min(0).default(0),
  effective_from: z.string(),
})

export async function updatePayRate(homeId: string, staffId: string, rateId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = PayRateSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('staff_pay_rates')
    .update({
      role_code: parsed.data.role_code,
      rate_weekday_pence:       poundsToP(parsed.data.rate_weekday),
      rate_weekend_pence:       poundsToP(parsed.data.rate_weekend),
      rate_night_pence:         poundsToP(parsed.data.rate_night),
      rate_overtime_pence:      poundsToP(parsed.data.rate_overtime),
      rate_training_pence:      poundsToP(parsed.data.rate_training),
      rate_sleep_in_flat_pence: poundsToP(parsed.data.rate_sleep_in),
      effective_from: parsed.data.effective_from,
      updated_by_user_id: user.id,
    })
    .eq('id', rateId).eq('home_id', homeId).eq('staff_id', staffId)
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

export async function addPayRate(homeId: string, staffId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = PayRateSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('staff_pay_rates').insert({
    home_id: homeId, tenant_id: homeId, staff_id: staffId,
    role_code: parsed.data.role_code,
    rate_weekday_pence:       poundsToP(parsed.data.rate_weekday),
    rate_weekend_pence:       poundsToP(parsed.data.rate_weekend),
    rate_night_pence:         poundsToP(parsed.data.rate_night),
    rate_overtime_pence:      poundsToP(parsed.data.rate_overtime),
    rate_training_pence:      poundsToP(parsed.data.rate_training),
    rate_sleep_in_flat_pence: poundsToP(parsed.data.rate_sleep_in),
    effective_from: parsed.data.effective_from,
    created_by_user_id: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

// ── Documents ─────────────────────────────────────────────────────────────────

const DocumentSchema = z.object({
  doc_type: z.enum([
    'passport', 'biometric_residence_permit', 'share_code', 'dbs_certificate',
    'proof_of_address', 'training_certificate', 'fit_note', 'p45', 'p60',
    'contract', 'nmc_pin', 'driving_licence', 'other',
  ]),
  document_number: z.string().max(100).optional(),
  issue_date:      z.string().optional(),
  expiry_date:     z.string().optional(),
})

export async function addDocument(homeId: string, staffId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = DocumentSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('staff_documents').insert({
    home_id: homeId, tenant_id: homeId, staff_id: staffId,
    doc_type: parsed.data.doc_type,
    document_number: parsed.data.document_number || null,
    issue_date:  parsed.data.issue_date  || null,
    expiry_date: parsed.data.expiry_date || null,
    created_by_user_id: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

export async function updateDocument(homeId: string, staffId: string, docId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = DocumentSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('staff_documents')
    .update({
      doc_type: parsed.data.doc_type,
      document_number: parsed.data.document_number || null,
      issue_date:  parsed.data.issue_date  || null,
      expiry_date: parsed.data.expiry_date || null,
      updated_by_user_id: user.id,
    })
    .eq('id', docId).eq('home_id', homeId).eq('staff_id', staffId)
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

// ── Training ──────────────────────────────────────────────────────────────────

const TrainingCertSchema = z.object({
  training_topic_id: z.string().uuid(),
  issue_date:  z.string(),
  expiry_date: z.string().optional(),
})

export async function addTrainingCert(homeId: string, staffId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = TrainingCertSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('staff_training_certs').insert({
    home_id: homeId, tenant_id: homeId, staff_id: staffId,
    training_topic_id: parsed.data.training_topic_id,
    issue_date:  parsed.data.issue_date,
    expiry_date: parsed.data.expiry_date || null,
    created_by_user_id: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

export async function updateTrainingCert(homeId: string, staffId: string, certId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = TrainingCertSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('staff_training_certs')
    .update({
      training_topic_id: parsed.data.training_topic_id,
      issue_date:  parsed.data.issue_date,
      expiry_date: parsed.data.expiry_date || null,
      updated_by_user_id: user.id,
    })
    .eq('id', certId).eq('home_id', homeId).eq('staff_id', staffId)
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

// ── Sponsorship ───────────────────────────────────────────────────────────────

const SponsorshipSchema = z.object({
  cos_reference:          z.string().min(1).max(50),
  sponsor_licence_number: z.string().min(1).max(50),
  route:                  z.string().min(1).max(50),
  minimum_hours_per_week: z.coerce.number().min(0).max(168),
  cos_start_date:         z.string(),
  cos_end_date:           z.string(),
})

export async function upsertSponsorship(homeId: string, staffId: string, sponsorshipId: string | null, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = SponsorshipSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  if (sponsorshipId) {
    const { error } = await supabase.from('staff_sponsorship')
      .update({ ...parsed.data, updated_by_user_id: user.id })
      .eq('id', sponsorshipId).eq('home_id', homeId).eq('staff_id', staffId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('staff_sponsorship').insert({
      home_id: homeId, tenant_id: homeId, staff_id: staffId,
      ...parsed.data,
      created_by_user_id: user.id,
    })
    if (error) return { error: error.message }
  }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

// ── Leave ─────────────────────────────────────────────────────────────────────

const LeaveRequestSchema = z.object({
  type: z.enum(['annual', 'compassionate', 'maternity', 'paternity', 'shared_parental', 'adoption', 'unpaid', 'toil', 'other']),
  start_date:      z.string(),
  end_date:        z.string(),
  value_requested: z.coerce.number().min(0),
  status:          z.enum(['pending', 'approved', 'rejected']).default('approved'),
})

export async function addLeaveRequest(homeId: string, staffId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = LeaveRequestSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('leave_requests').insert({
    home_id: homeId, tenant_id: homeId, staff_id: staffId,
    ...parsed.data,
    submitted_at: new Date().toISOString(),
    created_by_user_id: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

export async function updateLeaveRequestStatus(homeId: string, staffId: string, requestId: string, status: 'approved' | 'rejected') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { error } = await supabase.from('leave_requests')
    .update({ status, updated_by_user_id: user.id })
    .eq('id', requestId).eq('home_id', homeId).eq('staff_id', staffId)
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

const LeaveBalanceSchema = z.object({
  entitlement_value: z.coerce.number().min(0),
  leave_year_start:  z.string(),
  allocation_unit:   z.enum(['hours', 'days']),
})

export async function upsertLeaveBalance(homeId: string, staffId: string, balanceId: string | null, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = LeaveBalanceSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  if (balanceId) {
    const { error } = await supabase.from('leave_balances')
      .update({ entitlement_value: parsed.data.entitlement_value, leave_year_start: parsed.data.leave_year_start, allocation_unit: parsed.data.allocation_unit, updated_by_user_id: user.id })
      .eq('id', balanceId).eq('home_id', homeId).eq('staff_id', staffId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('leave_balances').insert({
      home_id: homeId, tenant_id: homeId, staff_id: staffId,
      entitlement_value: parsed.data.entitlement_value,
      leave_year_start:  parsed.data.leave_year_start,
      allocation_unit:   parsed.data.allocation_unit,
      taken_value: 0, booked_value: 0, accrued_value: 0,
      created_by_user_id: user.id,
    })
    if (error) return { error: error.message }
  }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

// ── Fixed schedule ────────────────────────────────────────────────────────────

export async function saveFixedSchedule(homeId: string, staffId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  // Delete all current fixed shifts for this staff member
  const { error: delError } = await supabase
    .from('staff_fixed_shifts')
    .delete()
    .eq('staff_id', staffId)
    .eq('home_id', homeId)
  if (delError) return { error: delError.message }

  const today = new Date().toISOString().split('T')[0]!
  type FixedShiftInsert = {
    home_id: string; tenant_id: string; staff_id: string
    day_of_week: number; shift_template_id: string
    effective_from: string; created_by_user_id: string
  }
  const inserts: FixedShiftInsert[] = []
  for (let day = 0; day <= 6; day++) {
    const templateId = formData.get(`day_${day}`)
    if (templateId && typeof templateId === 'string' && templateId !== '') {
      inserts.push({
        home_id: homeId, tenant_id: homeId, staff_id: staffId,
        day_of_week: day,
        shift_template_id: templateId,
        effective_from: today,
        created_by_user_id: user.id,
      })
    }
  }

  if (inserts.length > 0) {
    const { error: insError } = await supabase.from('staff_fixed_shifts').insert(inserts)
    if (insError) return { error: insError.message }
  }

  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}

// ── Sickness ──────────────────────────────────────────────────────────────────

const SicknessSchema = z.object({
  first_day_of_sickness: z.string(),
  last_day_of_sickness:  z.string().optional(),
})

export async function addSicknessEpisode(homeId: string, staffId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = SicknessSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  let qualifying_days: number | null = null
  let ssp_eligible = false
  if (parsed.data.last_day_of_sickness) {
    const start = new Date(parsed.data.first_day_of_sickness)
    const end   = new Date(parsed.data.last_day_of_sickness)
    const calendar_days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1
    qualifying_days = Math.max(0, calendar_days - 3)
    ssp_eligible = qualifying_days > 0
  }

  const { error } = await supabase.from('sickness_episodes').insert({
    home_id: homeId, tenant_id: homeId, staff_id: staffId,
    first_day_of_sickness: parsed.data.first_day_of_sickness,
    last_day_of_sickness:  parsed.data.last_day_of_sickness || null,
    qualifying_days, ssp_eligible,
    created_by_user_id: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}
