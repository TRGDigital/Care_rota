import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { LeaveApprovalClient } from './leave-approval-client'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function datesToArray(start: string, end: string): string[] {
  const dates: string[] = []
  const cursor = new Date(start)
  const endDate = new Date(end)
  while (cursor <= endDate) {
    dates.push(cursor.toISOString().split('T')[0]!)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export default async function LeaveApprovalPage({
  params,
}: {
  params: Promise<{ homeId: string; requestId: string }>
}) {
  const { homeId, requestId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: request } = await supabase
    .from('leave_requests')
    .select(`
      id, type, start_date, end_date, value_requested, status, submitted_at,
      staff_message, manager_note,
      staff_id, staff(id, first_name, last_name, employee_number)
    `)
    .eq('id', requestId)
    .eq('home_id', homeId)
    .single()

  if (!request) notFound()

  // Leave balance for this staff member
  const { data: balance } = await supabase
    .from('leave_balances')
    .select('entitlement_value, taken_value, booked_value, scheduled_value, balance_remaining, allocation_unit')
    .eq('staff_id', request.staff_id)
    .eq('home_id', homeId)
    .order('leave_year_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Last 3 requests for context
  const { data: previousRequests } = await supabase
    .from('leave_requests')
    .select('id, type, start_date, end_date, status')
    .eq('staff_id', request.staff_id)
    .eq('home_id', homeId)
    .neq('id', requestId)
    .order('submitted_at', { ascending: false })
    .limit(3)

  const affectedDates = datesToArray(request.start_date, request.end_date)

  // Rota context: find published shifts on those dates
  const { data: slotIds } = await supabase
    .from('shift_slots')
    .select('id, date, role_code')
    .eq('home_id', homeId)
    .in('date', affectedDates)
    .in(
      'rota_period_id',
      (
        await supabase
          .from('rota_periods')
          .select('id')
          .eq('home_id', homeId)
          .eq('status', 'published')
      ).data?.map(p => p.id) ?? []
    )

  const slotIdList = (slotIds ?? []).map(s => s.id)

  const { data: rotaShifts } = slotIdList.length
    ? await supabase
        .from('shifts')
        .select('id, shift_slot_id, staff_id, state, planned_start_utc, planned_end_utc')
        .in('shift_slot_id', slotIdList)
        .not('state', 'in', '(cancelled,no_show)')
    : { data: [] }

  // Staff names for rota shifts
  const assignedIds = [...new Set((rotaShifts ?? []).filter(s => s.staff_id).map(s => s.staff_id!))]
  const { data: rotaStaff } = assignedIds.length
    ? await supabase.from('staff').select('id, first_name, last_name').in('id', assignedIds)
    : { data: [] }

  const staffNameMap: Record<string, string> = Object.fromEntries(
    (rotaStaff ?? []).map(s => [s.id, `${s.first_name} ${s.last_name}`])
  )

  // Build rota context per date
  type RotaDay = { date: string; slots: Array<{ slotId: string; role: string; shifts: Array<{ id: string; staffName: string | null; isRequester: boolean }> }> }
  const rotaByDate: RotaDay[] = affectedDates.map(date => {
    const daySlots = (slotIds ?? []).filter(s => s.date === date)
    return {
      date,
      slots: daySlots.map(slot => ({
        slotId: slot.id,
        role: slot.role_code,
        shifts: (rotaShifts ?? [])
          .filter(sh => sh.shift_slot_id === slot.id)
          .map(sh => ({
            id: sh.id,
            staffName: sh.staff_id ? (staffNameMap[sh.staff_id] ?? null) : null,
            isRequester: sh.staff_id === request.staff_id,
          })),
      })),
    }
  })

  // Possible cover staff (active, not on leave on any of the dates)
  const { data: coverCandidates } = await supabase
    .from('staff')
    .select('id, first_name, last_name')
    .eq('home_id', homeId)
    .eq('status', 'active')
    .neq('id', request.staff_id)
    .order('last_name')

  const staff = Array.isArray(request.staff) ? request.staff[0] : request.staff

  return (
    <PageShell
      title={`Leave request — ${staff ? `${staff.first_name} ${staff.last_name}` : '—'}`}
      description={`${fmtDate(request.start_date)} – ${fmtDate(request.end_date)} · ${request.value_requested}h`}
      backHref={`/homes/${homeId}/leave`}
    >
      <LeaveApprovalClient
        homeId={homeId}
        request={{
          id: request.id,
          type: request.type,
          start_date: request.start_date,
          end_date: request.end_date,
          value_requested: request.value_requested,
          status: request.status,
          staff_message: request.staff_message,
          staffName: staff ? `${staff.first_name} ${staff.last_name}` : '—',
        }}
        balance={balance ?? null}
        previousRequests={previousRequests ?? []}
        rotaByDate={rotaByDate}
        coverCandidates={coverCandidates ?? []}
      />
    </PageShell>
  )
}
