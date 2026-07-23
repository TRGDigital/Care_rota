'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { resetToEqualShares } from '@/lib/redistribute-weighting'

const CreateStaffSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  employee_number: z.string().max(50).optional(),
  date_of_birth: z.string().optional(),
  ni_number: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  date_started: z.string().optional(),
  role_id: z.string().uuid().optional(),
  contract_type: z.enum(['full_time', 'part_time', 'bank', 'zero_hours']),
  contracted_hours_per_week: z.coerce.number().min(0).max(168).default(0),
  shift_pattern_preference: z.enum(['any', 'day_only', 'night_only', 'days_and_nights', 'early_only', 'late_only', 'no_nights', 'no_weekends', 'fixed']).default('any'),
  holiday_entitlement_value: z.coerce.number().min(0).default(28),
  effective_from: z.string(),
  overtime_eligible: z.string().optional().transform(v => v !== 'off'),
})

export async function createStaff(homeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => v !== '')
  )
  const parsed = CreateStaffSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { first_name, last_name, employee_number, date_of_birth, ni_number, address,
    date_started, role_id, contract_type, contracted_hours_per_week,
    shift_pattern_preference, holiday_entitlement_value, effective_from,
    overtime_eligible } = parsed.data

  // Insert staff member
  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .insert({
      home_id: homeId,
      tenant_id: homeId,
      first_name,
      last_name,
      employee_number: employee_number || null,
      date_of_birth: date_of_birth || null,
      ni_number: ni_number || null,
      address: address || null,
      date_started: date_started || null,
      overtime_eligible,
      created_by_user_id: user.id,
    })
    .select('id')
    .single()

  if (staffError || !staffRow) return { error: staffError?.message ?? 'Failed to create staff record' }

  const staffId = staffRow.id

  // Insert initial contract
  const { error: contractError } = await supabase
    .from('staff_contracts')
    .insert({
      home_id: homeId,
      tenant_id: homeId,
      staff_id: staffId,
      contract_type,
      contracted_hours_per_week,
      shift_pattern_preference,
      holiday_entitlement_value,
      effective_from,
      created_by_user_id: user.id,
    })

  if (contractError) return { error: contractError.message }

  // Assign role if provided
  if (role_id) {
    await supabase.from('staff_fixed_shifts').select('id').limit(0) // no-op — role assignment goes on staff_contracts in v2
  }

  revalidatePath(`/homes/${homeId}/staff`)
  redirect(`/homes/${homeId}/staff/${staffId}`)
}

const UpdateStaffSchema = z.object({
  first_name:        z.string().min(1).max(100),
  last_name:         z.string().min(1).max(100),
  employee_number:   z.string().max(50).optional(),
  date_of_birth:     z.string().optional(),
  ni_number:         z.string().max(20).optional(),
  address:           z.string().max(500).optional(),
  date_started:      z.string().optional(),
  date_left:         z.string().optional(),
  status:            z.enum(['active', 'inactive', 'on_leave', 'maternity', 'paternity', 'shared_parental', 'adoption', 'long_term_sick', 'suspended', 'left']),
  overtime_eligible: z.string().optional().transform(v => v !== 'off'),
})

export async function updateStaff(homeId: string, staffId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ''))
  const parsed = UpdateStaffSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { first_name, last_name, employee_number, date_of_birth, ni_number, address, date_started, date_left, status, overtime_eligible } = parsed.data

  // Fetch current values to detect changes
  const { data: current } = await supabase
    .from('staff')
    .select('overtime_eligible, status')
    .eq('id', staffId)
    .eq('home_id', homeId)
    .single()

  const goingInactive = status !== 'active'

  const { error } = await supabase
    .from('staff')
    .update({
      first_name,
      last_name,
      employee_number:   employee_number || null,
      date_of_birth:     date_of_birth   || null,
      ni_number:         ni_number       || null,
      address:           address         || null,
      date_started:      date_started    || null,
      date_left:         date_left       || null,
      status,
      overtime_eligible,
      ...((overtime_eligible === false || goingInactive) && { overtime_weighting: 0 }),
      updated_by_user_id: user.id,
    })
    .eq('id', staffId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }

  // Redistribute if eligibility or active status changed
  const eligibilityChanged = current && current.overtime_eligible !== overtime_eligible
  const activeStatusChanged = current && current.status !== status &&
    (current.status === 'active' || status === 'active')

  if (eligibilityChanged || activeStatusChanged) {
    await resetToEqualShares(supabase, homeId, user.id)
  }

  revalidatePath(`/homes/${homeId}/staff`)
  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true }
}
