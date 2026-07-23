import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { StaffTabs } from './staff-tabs'

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string; staffId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { homeId, staffId } = await params
  const { tab = 'personal' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('id', staffId)
    .eq('home_id', homeId)
    .single()

  if (!staff) notFound()

  const [
    { data: contracts },
    { data: payRates },
    { data: documents },
    { data: training },
    { data: sponsorship },
    { data: sickness },
    { data: leaveRequests },
    { data: leaveBalance },
    { data: trainingTopics },
    { data: shiftTemplates },
    { data: fixedShifts },
  ] = await Promise.all([
    supabase.from('staff_contracts').select('*').eq('staff_id', staffId).order('effective_from', { ascending: false }),
    supabase.from('staff_pay_rates').select('*').eq('staff_id', staffId).order('effective_from', { ascending: false }),
    supabase.from('staff_documents').select('*').eq('staff_id', staffId).order('created_at', { ascending: false }),
    supabase.from('staff_training_certs').select('*, training_topics(name)').eq('staff_id', staffId).order('expiry_date', { ascending: true }),
    supabase.from('staff_sponsorship').select('*').eq('staff_id', staffId).maybeSingle(),
    supabase.from('sickness_episodes').select('*').eq('staff_id', staffId).eq('home_id', homeId).order('first_day_of_sickness', { ascending: false }).limit(20),
    supabase.from('leave_requests').select('id, type, start_date, end_date, value_requested, status, submitted_at').eq('staff_id', staffId).eq('home_id', homeId).order('submitted_at', { ascending: false }).limit(20),
    supabase.from('leave_balances').select('*').eq('staff_id', staffId).eq('home_id', homeId).order('leave_year_start', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('training_topics').select('id, name').eq('home_id', homeId).order('name'),
    supabase.from('shift_pattern_templates').select('id, name, start_time_local, end_time_local, paid_hours_decimal').eq('home_id', homeId).order('start_time_local'),
    supabase.from('staff_fixed_shifts').select('id, day_of_week, shift_template_id, effective_from, effective_to').eq('staff_id', staffId).eq('home_id', homeId).is('effective_to', null),
  ])

  return (
    <PageShell
      title={`${staff.first_name} ${staff.last_name}`}
      {...(staff.employee_number ? { description: `#${staff.employee_number}` } : {})}
      backHref={`/homes/${homeId}/staff`}
    >
      <StaffTabs
        homeId={homeId}
        staff={staff}
        contracts={contracts ?? []}
        payRates={payRates ?? []}
        documents={documents ?? []}
        training={training ?? []}
        trainingTopics={trainingTopics ?? []}
        shiftTemplates={shiftTemplates ?? []}
        fixedShifts={fixedShifts ?? []}
        sponsorship={sponsorship ?? null}
        sickness={sickness ?? []}
        leaveRequests={leaveRequests ?? []}
        leaveBalance={leaveBalance ?? null}
        activeTab={tab}
      />
    </PageShell>
  )
}
