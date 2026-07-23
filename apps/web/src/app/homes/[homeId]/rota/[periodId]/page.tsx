import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { RotaGrid } from './rota-grid'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function RotaBuilderPage({
  params,
}: {
  params: Promise<{ homeId: string; periodId: string }>
}) {
  const { homeId, periodId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: period } = await supabase
    .from('rota_periods')
    .select('id, period_start_date, period_end_date, status')
    .eq('id', periodId)
    .eq('home_id', homeId)
    .single()

  if (!period) notFound()

  // Fetch all shift slots for this period
  const { data: slots } = await supabase
    .from('shift_slots')
    .select('id, date, role_code, headcount_required, shift_pattern_template_id, shift_pattern_templates(name, start_time_local, end_time_local)')
    .eq('rota_period_id', periodId)
    .order('date')
    .order('role_code')

  // Fetch all shifts for this period's slots
  const slotIds = (slots ?? []).map(s => s.id)
  const { data: shifts } = slotIds.length
    ? await supabase
        .from('shifts')
        .select('id, shift_slot_id, staff_id, state, planned_start_utc, planned_end_utc, planned_paid_hours, is_bank_holiday, is_christmas_period, premium_multiplier')
        .in('shift_slot_id', slotIds)
        .not('state', 'eq', 'cancelled')
    : { data: [] }

  // Fetch staff names for assigned shifts
  const assignedStaffIds = [...new Set(
    (shifts ?? []).filter(s => s.staff_id).map(s => s.staff_id!)
  )]
  const { data: staffData } = assignedStaffIds.length
    ? await supabase
        .from('staff')
        .select('id, first_name, last_name, shift_type')
        .in('id', assignedStaffIds)
    : { data: [] }

  const staffMap = new Map((staffData ?? []).map(s => [s.id, `${s.first_name} ${s.last_name}`]))
  const nightStaffIds = (staffData ?? []).filter(s => s.shift_type === 'night').map(s => s.id)

  // Build date columns
  const start = new Date(period.period_start_date)
  const end = new Date(period.period_end_date)
  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(cursor.toISOString().split('T')[0]!)
    cursor.setDate(cursor.getDate() + 1)
  }

  type ShiftRow = NonNullable<typeof shifts>[number]
  // Group shifts by slot_id — use a plain Record so it serializes across the server/client boundary
  const shiftsBySlot: Record<string, ShiftRow[]> = {}
  for (const shift of shifts ?? []) {
    if (!shiftsBySlot[shift.shift_slot_id]) shiftsBySlot[shift.shift_slot_id] = []
    shiftsBySlot[shift.shift_slot_id]!.push(shift)
  }

  const staffRecord: Record<string, string> = Object.fromEntries(staffMap)

  return (
    <PageShell
      title={`Rota: ${fmtDate(period.period_start_date)} – ${fmtDate(period.period_end_date)}`}
      description={period.status === 'draft' ? 'Draft — not visible to staff' : 'Published'}
      backHref={`/homes/${homeId}/rota`}
    >
      <RotaGrid
        homeId={homeId}
        periodId={periodId}
        status={period.status}
        dates={dates}
        slots={slots ?? []}
        shiftsBySlot={shiftsBySlot}
        staffMap={staffRecord}
        nightStaffIds={nightStaffIds}
      />
    </PageShell>
  )
}
