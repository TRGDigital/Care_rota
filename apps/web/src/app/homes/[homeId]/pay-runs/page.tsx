import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronRight, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@carerota/ui'
import { startPayRun } from './actions'

const STATE_BADGE: Record<string, { label: string; className: string }> = {
  draft:      { label: 'Draft',       className: 'bg-muted text-muted-foreground' },
  in_review:  { label: 'In review',   className: 'bg-blue-100 text-blue-800' },
  approved:   { label: 'Approved',    className: 'bg-green-100 text-green-800' },
  exported:   { label: 'Exported',    className: 'bg-purple-100 text-purple-800' },
  locked:     { label: 'Locked',      className: 'bg-gray-100 text-gray-500' },
}

export default async function PayRunsPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: periods } = await supabase
    .from('pay_periods')
    .select(`
      id, period_start_date, period_end_date, pay_day, weeks_in_period, status,
      pay_runs ( id, status, approved_at )
    `)
    .eq('home_id', homeId)
    .order('period_start_date', { ascending: false })
    .limit(12)

  return (
    <PageShell title="Pay runs" description="Review and approve payroll by period.">
      <div className="max-w-2xl mt-6 space-y-4">
        {!periods?.length && (
          <div className="text-sm text-muted-foreground border rounded-lg py-8 text-center">
            No pay periods yet. Configure a pay cycle in Settings → Payroll.
          </div>
        )}
        {periods?.map(period => {
          const runs = (period.pay_runs as { id: string; status: string; approved_at: string | null }[] | null) ?? []
          const activeRun = runs.find(r => r.status !== 'void')
          const badge = activeRun ? STATE_BADGE[activeRun.status] : null

          return (
            <div key={period.id} className="bg-card border rounded-lg px-4 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {fmtDate(period.period_start_date)} – {fmtDate(period.period_end_date)}
                  </span>
                  {badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Pay day: {fmtDate(period.pay_day)} · {period.weeks_in_period} weeks
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!activeRun ? (
                  <form action={startPayRun}>
                    <input type="hidden" name="homeId" value={homeId} />
                    <input type="hidden" name="payPeriodId" value={period.id} />
                    <Button type="submit" size="sm">Run payroll</Button>
                  </form>
                ) : (
                  <Link href={`/homes/${homeId}/pay-runs/${activeRun.id}`}>
                    <Button variant="outline" size="sm">
                      Review
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </PageShell>
  )
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
