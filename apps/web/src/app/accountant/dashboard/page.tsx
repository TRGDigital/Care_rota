import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, CheckCircle2, Clock, FileCheck } from 'lucide-react'

export default async function AccountantDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Find all non-revoked invitations for this accountant
  const { data: invitations } = await supabase
    .from('accountant_invitations')
    .select('id, home_id, role_scope, organisation_id')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .not('accepted_at', 'is', null)

  if (!invitations || invitations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center space-y-4">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold">No homes accessible</h1>
          <p className="text-sm text-muted-foreground">
            You do not currently have access to any care homes. Ask the home manager to send you an invitation.
          </p>
        </div>
      </div>
    )
  }

  // Collect home IDs
  const homeIds = [...new Set(invitations.map(i => i.home_id).filter(Boolean) as string[])]

  const { data: homes } = await supabase
    .from('homes')
    .select('id, name, address')
    .in('id', homeIds)

  // Latest pay run per home
  const { data: latestRuns } = await supabase
    .from('pay_runs')
    .select(`
      id, home_id, status, marked_filed_at,
      pay_periods!inner ( period_start_date, period_end_date, pay_day )
    `)
    .in('home_id', homeIds)
    .order('created_at', { ascending: false })

  // Group by home_id — first is the latest
  const latestByHome = new Map<string, typeof latestRuns extends (infer T)[] | null ? T : never>()
  for (const run of latestRuns ?? []) {
    if (!latestByHome.has(run.home_id)) latestByHome.set(run.home_id, run)
  }

  const homeList = (homes ?? []).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Accountant portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Viewing payroll data for {homeList.length} care home{homeList.length !== 1 ? 's' : ''}.
          </p>
        </div>

        <div className="space-y-3">
          {homeList.map(home => {
            const run = latestByHome.get(home.id)
            const period = run?.pay_periods as { period_start_date: string; period_end_date: string; pay_day: string } | null

            return (
              <Link
                key={home.id}
                href={`/accountant/${home.id}/pay-runs`}
                className="block bg-card border rounded-lg px-5 py-4 hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{home.name}</div>
                    {home.address && (
                      <div className="text-xs text-muted-foreground truncate">{home.address}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {run && period ? (
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted-foreground">
                          {fmtDate(period.period_start_date)} – {fmtDate(period.period_end_date)}
                        </div>
                        <RunStatusChip status={run.status} filed={!!run.marked_filed_at} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No pay runs yet</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RunStatusChip({ status, filed }: { status: string; filed: boolean }) {
  if (filed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
        <FileCheck className="h-3 w-3" /> Filed
      </span>
    )
  }
  if (status === 'approved' || status === 'exported' || status === 'locked') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
      <Clock className="h-3 w-3" /> {status.replace(/_/g, ' ')}
    </span>
  )
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
