import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { PayRunReviewClient } from './pay-run-review-client'

export default async function PayRunReviewPage({
  params,
}: {
  params: Promise<{ homeId: string; runId: string }>
}) {
  const { homeId, runId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: run } = await supabase
    .from('pay_runs')
    .select(`
      id, status, approved_at, submitted_for_review_at,
      pay_periods!inner (
        period_start_date, period_end_date, pay_day, weeks_in_period
      )
    `)
    .eq('id', runId)
    .eq('home_id', homeId)
    .single()

  if (!run) redirect(`/homes/${homeId}/pay-runs`)

  const period = (run.pay_periods as { period_start_date: string; period_end_date: string; pay_day: string; weeks_in_period: number } | null)
  if (!period) redirect(`/homes/${homeId}/pay-runs`)

  // Load payslips with staff info
  const { data: payslips } = await supabase
    .from('payslips')
    .select(`
      id, staff_id, gross_total_pence, net_pay_pence,
      gross_weekday_pence, gross_weekend_pence, gross_bank_holiday_pence,
      gross_christmas_pence, gross_overtime_pence, gross_sickness_pence,
      gross_sleep_in_pence, gross_training_pence,
      ni_employee_pence, paye_tax_pence, pension_employee_pence,
      statutory_payments_pence,
      staff!inner ( first_name, last_name )
    `)
    .eq('pay_run_id', runId)
    .order('staff_id')

  // Load NMW reference rates for breach detection
  const { data: refRates } = await supabase
    .from('reference_wage_rates')
    .select('age_band, rate_pence, effective_from, effective_to')

  // Load staff DOBs for NMW check
  const staffIds = payslips?.map(p => p.staff_id) ?? []
  const { data: staffDobs } = staffIds.length > 0
    ? await supabase
        .from('staff')
        .select('id, date_of_birth')
        .in('id', staffIds)
    : { data: [] }

  const dobMap = Object.fromEntries((staffDobs ?? []).map(s => [s.id, s.date_of_birth]))

  // Compare with previous period gross
  const { data: prevPayslips } = await supabase
    .from('payslips')
    .select('gross_total_pence, net_pay_pence, ni_employer_pence, pension_employer_pence')
    .neq('pay_run_id', runId)
    .eq('home_id', homeId)
    .limit(100)

  const prevTotalGross = prevPayslips?.reduce((a, p) => a + p.gross_total_pence, 0) ?? 0

  return (
    <PageShell
      title={`Pay run — ${fmtDate(period.period_start_date)} to ${fmtDate(period.period_end_date)}`}
      description={`Pay day: ${fmtDate(period.pay_day)} · ${period.weeks_in_period} weeks`}
    >
      <PayRunReviewClient
        homeId={homeId}
        runId={runId}
        status={run.status}
        payslips={payslips ?? []}
        refRates={refRates ?? []}
        dobMap={dobMap}
        periodEndDate={period.period_end_date}
        prevTotalGross={prevTotalGross}
      />
    </PageShell>
  )
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
