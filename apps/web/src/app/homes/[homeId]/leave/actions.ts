'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { raiseRebalanceSuggestion } from '@carerota/domain/server'
import { z } from 'zod'

const LeaveRequestSchema = z.object({
  leave_type: z.enum(['annual', 'compassionate', 'maternity', 'paternity', 'shared_parental', 'adoption', 'unpaid', 'toil', 'other']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value_requested: z.coerce.number().positive(),
  staff_message: z.string().optional(),
})

export async function submitLeaveRequest(homeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = LeaveRequestSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid' }

  const { leave_type, start_date, end_date, value_requested, staff_message } = parsed.data

  if (end_date < start_date) return { error: 'End date must be on or after start date' }

  // Find the staff record for the current user
  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('home_id', homeId)
    .eq('user_id', user.id)
    .single()

  if (!staff) return { error: 'No staff record found for your account' }

  const { error } = await supabase.from('leave_requests').insert({
    home_id: homeId,
    tenant_id: homeId,
    staff_id: staff.id,
    type: leave_type,
    start_date,
    end_date,
    value_requested,
    staff_message: staff_message ?? null,
    status: 'pending',
    created_by_user_id: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/leave`)
  return { success: true }
}

export async function approveLeaveRequest(
  homeId: string,
  requestId: string,
  formData: FormData
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const managerNote = formData.get('manager_note') as string | null
  const coverStaffId = formData.get('cover_staff_id') as string | null

  const { data: request } = await supabase
    .from('leave_requests')
    .select('id, staff_id, start_date, end_date, value_requested')
    .eq('id', requestId)
    .eq('home_id', homeId)
    .single()

  if (!request) return { error: 'Request not found' }

  // Approve the request
  const { error: approveError } = await supabase
    .from('leave_requests')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      decided_by_user_id: user.id,
      manager_note: managerNote ?? null,
      covering_staff_id: coverStaffId ?? null,
      updated_by_user_id: user.id,
    })
    .eq('id', requestId)
    .eq('home_id', homeId)

  if (approveError) return { error: approveError.message }

  // Update leave balance: move from scheduled/pending to booked
  const { data: balance } = await supabase
    .from('leave_balances')
    .select('id, scheduled_value, booked_value')
    .eq('staff_id', request.staff_id)
    .eq('home_id', homeId)
    .order('leave_year_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (balance) {
    await supabase
      .from('leave_balances')
      .update({
        scheduled_value: Math.max(0, balance.scheduled_value - request.value_requested),
        booked_value: balance.booked_value + request.value_requested,
        updated_by_user_id: user.id,
      })
      .eq('id', balance.id)
  }

  // Build date range for affected dates
  const affectedDates: string[] = []
  const cursor = new Date(request.start_date)
  const end = new Date(request.end_date)
  while (cursor <= end) {
    affectedDates.push(cursor.toISOString().split('T')[0]!)
    cursor.setDate(cursor.getDate() + 1)
  }

  // Release assigned shifts on those dates and optionally re-assign cover
  const { data: slotIds } = await supabase
    .from('shift_slots')
    .select('id')
    .eq('home_id', homeId)
    .in('date', affectedDates)

  if (slotIds?.length) {
    const { data: affectedShifts } = await supabase
      .from('shifts')
      .select('id')
      .in('shift_slot_id', slotIds.map(s => s.id))
      .eq('staff_id', request.staff_id)
      .eq('state', 'assigned')

    if (affectedShifts?.length) {
      for (const sh of affectedShifts) {
        await supabase.from('shifts').update({
          staff_id: coverStaffId ?? null,
          state: coverStaffId ? 'assigned' : 'unassigned',
          updated_by_user_id: user.id,
        }).eq('id', sh.id)
      }

      // Raise rebalance suggestion for any uncovered shifts
      if (!coverStaffId) {
        await raiseRebalanceSuggestion(
          supabase as never,
          homeId,
          'leave_approved',
          requestId,
          request.staff_id,
          affectedDates,
          user.id
        )
      }
    }
  }

  revalidatePath(`/homes/${homeId}/leave`)
  revalidatePath(`/homes/${homeId}/rota`)
  return { success: true }
}

export async function rejectLeaveRequest(
  homeId: string,
  requestId: string,
  formData: FormData
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const managerNote = formData.get('manager_note') as string

  const { data: request } = await supabase
    .from('leave_requests')
    .select('staff_id, value_requested')
    .eq('id', requestId)
    .eq('home_id', homeId)
    .single()

  if (!request) return { error: 'Request not found' }

  const { error } = await supabase
    .from('leave_requests')
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString(),
      decided_by_user_id: user.id,
      manager_note: managerNote || null,
      updated_by_user_id: user.id,
    })
    .eq('id', requestId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }

  // Move scheduled value back to available
  const { data: balance } = await supabase
    .from('leave_balances')
    .select('id, scheduled_value')
    .eq('staff_id', request.staff_id)
    .eq('home_id', homeId)
    .order('leave_year_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (balance) {
    await supabase.from('leave_balances').update({
      scheduled_value: Math.max(0, balance.scheduled_value - request.value_requested),
      updated_by_user_id: user.id,
    }).eq('id', balance.id)
  }

  revalidatePath(`/homes/${homeId}/leave`)
  return { success: true }
}
