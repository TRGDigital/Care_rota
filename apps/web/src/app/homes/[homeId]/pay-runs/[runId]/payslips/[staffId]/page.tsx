import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { PayslipDetailClient } from './payslip-detail-client'

export default async function PayslipDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; runId: string; staffId: string }>
}) {
  const { homeId, runId, staffId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: run } = await supabase
    .from('pay_runs')
    .select('id, status, pay_periods!inner(period_start_date, period_end_date, pay_day)')
    .eq('id', runId)
    .eq('home_id', homeId)
    .single()
  if (!run) redirect(`/homes/${homeId}/pay-runs`)

  const period = run.pay_periods as { period_start_date: string; period_end_date: string; pay_day: string } | null
  if (!period) redirect(`/homes/${homeId}/pay-runs`)

  const { data: payslip } = await supabase
    .from('payslips')
    .select('*')
    .eq('pay_run_id', runId)
    .eq('staff_id', staffId)
    .single()
  if (!payslip) redirect(`/homes/${homeId}/pay-runs/${runId}`)

  const { data: lines } = await supabase
    .from('payslip_lines')
    .select('*')
    .eq('payslip_id', payslip.id)
    .order('line_type')

  const { data: member } = await supabase
    .from('staff')
    .select('first_name, last_name, ni_number')
    .eq('id', staffId)
    .single()

  const { data: comments } = await supabase
    .from('payroll_comments')
    .select('id, body, author_name, created_at, is_accountant')
    .eq('pay_run_id', runId)
    .order('created_at', { ascending: true })

  return (
    <PageShell
      title={`${member?.first_name} ${member?.last_name} — Payslip`}
      description={`${fmtDate(period.period_start_date)} to ${fmtDate(period.period_end_date)} · Pay day ${fmtDate(period.pay_day)}`}
    >
      <PayslipDetailClient
        homeId={homeId}
        payslipId={payslip.id}
        payslip={payslip}
        lines={lines ?? []}
        staffName={`${member?.first_name} ${member?.last_name}`}
        roleCode=""
        runStatus={run.status}
        runId={runId}
        comments={comments ?? []}
      />
    </PageShell>
  )
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
