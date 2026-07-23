import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { AccountantRunClient } from './accountant-run-client'

export default async function AccountantRunDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; runId: string }>
}) {
  const { homeId, runId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Verify access
  const { data: invitation } = await supabase
    .from('accountant_invitations')
    .select('id')
    .eq('user_id', user.id)
    .eq('home_id', homeId)
    .is('revoked_at', null)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!invitation) redirect('/accountant/dashboard')

  const { data: home } = await supabase
    .from('homes')
    .select('id, name')
    .eq('id', homeId)
    .single()

  if (!home) redirect('/accountant/dashboard')

  const { data: run } = await supabase
    .from('pay_runs')
    .select(`
      id, status, marked_filed_at, approved_at,
      pay_periods!inner ( period_start_date, period_end_date, pay_day )
    `)
    .eq('id', runId)
    .eq('home_id', homeId)
    .single()

  if (!run) redirect(`/accountant/${homeId}/pay-runs`)

  // Only show approved/exported/locked runs to accountants
  if (!['approved', 'exported', 'locked'].includes(run.status)) {
    redirect(`/accountant/${homeId}/pay-runs`)
  }

  const { data: payslips } = await supabase
    .from('payslips')
    .select(`
      id, staff_id, gross_total_pence, net_pay_pence,
      paye_tax_pence, ni_employee_pence, pension_employee_pence,
      staff!inner ( first_name, last_name )
    `)
    .eq('pay_run_id', runId)
    .order('staff_id')

  const { data: comments } = await supabase
    .from('payroll_comments')
    .select('id, body, author_name, created_at, is_accountant')
    .eq('pay_run_id', runId)
    .order('created_at', { ascending: true })

  // Preferred export format from pay cycle
  const { data: payrun } = await supabase
    .from('pay_runs')
    .select('pay_periods!inner ( pay_cycles!inner ( preferred_export_format ) )')
    .eq('id', runId)
    .single()

  type CycleJoin = { pay_cycles: { preferred_export_format: string | null } | null } | null
  type PeriodsJoin = { pay_periods: CycleJoin } | null
  const fmt = ((payrun as PeriodsJoin)?.pay_periods as CycleJoin)?.pay_cycles?.preferred_export_format ?? 'generic'

  const period = run.pay_periods as { period_start_date: string; period_end_date: string; pay_day: string } | null

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
        <div>
          <Link
            href={`/accountant/${homeId}/pay-runs`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ChevronLeft className="h-4 w-4" /> {home.name}
          </Link>
          <h1 className="text-2xl font-bold">
            {period ? `${fmtDate(period.period_start_date)} – ${fmtDate(period.period_end_date)}` : 'Pay run'}
          </h1>
          {period && (
            <p className="text-sm text-muted-foreground mt-0.5">Pay day: {fmtDate(period.pay_day)}</p>
          )}
        </div>

        <AccountantRunClient
          homeId={homeId}
          runId={runId}
          status={run.status}
          filedAt={run.marked_filed_at}
          payslips={payslips ?? []}
          comments={comments ?? []}
          exportFormat={fmt}
        />
      </div>
    </div>
  )
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
