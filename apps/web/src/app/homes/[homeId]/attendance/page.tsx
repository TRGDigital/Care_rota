import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { UnresolvedPunchesClient } from './unresolved-punches-client'

export default async function AttendancePage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Unresolved = no_show or no_clock_out, no manual override yet
  const { data: unresolvedRows } = await supabase
    .from('shifts_actual')
    .select(`
      id, reconciliation_status, actual_start_utc, actual_end_utc,
      actual_worked_minutes, last_reconciled_at,
      shift_id,
      shifts!inner (
        planned_start_utc, planned_end_utc,
        shift_slots ( shift_pattern_templates ( name, break_minutes ) )
      ),
      staff!inner ( id, first_name, last_name, employee_number, photo_url )
    `)
    .eq('home_id', homeId)
    .in('reconciliation_status', ['no_show', 'no_clock_out'])
    .order('last_reconciled_at', { ascending: false })
    .limit(100)

  return (
    <PageShell
      title="Unresolved punches"
      description="Shifts with no clock-in (no-show) or missing clock-out. Resolve each to release payroll."
    >
      <UnresolvedPunchesClient homeId={homeId} rows={unresolvedRows ?? []} />
    </PageShell>
  )
}
