import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FileCheck, Clock, CheckCircle2, Download } from 'lucide-react'

export default async function AccountantPayRunsPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Verify accountant has access to this home
  const { data: invitation } = await supabase
    .from('accountant_invitations')
    .select('id, role_scope')
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

  const { data: runs } = await supabase
    .from('pay_runs')
    .select(`
      id, status, marked_filed_at, approved_at,
      pay_periods!inner ( period_start_date, period_end_date, pay_day )
    `)
    .eq('home_id', homeId)
    .in('status', ['approved', 'exported', 'locked'])
    .order('created_at', { ascending: false })

  const payRuns = runs ?? []

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
        <div>
          <Link
            href="/accountant/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ChevronLeft className="h-4 w-4" /> All homes
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{home.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Approved pay runs</p>
            </div>
            <Link
              href={`/accountant/${homeId}/year-end`}
              className="text-sm text-primary underline"
            >
              Year-end summary
            </Link>
          </div>
        </div>

        {payRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved pay runs yet.</p>
        ) : (
          <div className="bg-card border rounded-lg divide-y">
            {payRuns.map(run => {
              const period = run.pay_periods as { period_start_date: string; period_end_date: string; pay_day: string } | null
              if (!period) return null
              return (
                <Link
                  key={run.id}
                  href={`/accountant/${homeId}/pay-runs/${run.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {fmtDate(period.period_start_date)} – {fmtDate(period.period_end_date)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Pay day: {fmtDate(period.pay_day)}
                      {run.approved_at && ` · Approved ${fmtDate(run.approved_at)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {run.marked_filed_at ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        <FileCheck className="h-3 w-3" /> Filed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" /> Unfiled
                      </span>
                    )}
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
