import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const TYPE_LABELS: Record<string, string> = {
  annual: 'Annual leave',
  compassionate: 'Compassionate',
  maternity: 'Maternity',
  paternity: 'Paternity',
  shared_parental: 'Shared parental',
  adoption: 'Adoption',
  unpaid: 'Unpaid leave',
  toil: 'TOIL',
  other: 'Other',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function LeaveInboxPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: requests } = await supabase
    .from('leave_requests')
    .select('id, type, start_date, end_date, value_requested, status, submitted_at, staff_id, staff(first_name, last_name, employee_number)')
    .eq('home_id', homeId)
    .order('submitted_at', { ascending: false })
    .limit(50)

  const pending = (requests ?? []).filter(r => r.status === 'pending')
  const decided = (requests ?? []).filter(r => r.status !== 'pending')

  return (
    <PageShell
      title="Leave inbox"
      description="Review and action staff leave requests"
      action={
        <Link
          href={`/homes/${homeId}/leave/new`}
          className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90"
        >
          + New request
        </Link>
      }
    >
      <div className="max-w-3xl mt-6 space-y-8">
        {/* Pending */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Pending ({pending.length})
          </h2>

          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No pending requests.</p>
          )}

          <div className="space-y-2">
            {pending.map(r => {
              const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff
              return (
                <Link
                  key={r.id}
                  href={`/homes/${homeId}/leave/${r.id}`}
                  className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm">
                      {staff ? `${staff.first_name} ${staff.last_name}` : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {TYPE_LABELS[r.type] ?? r.type} · {fmtDate(r.start_date)} – {fmtDate(r.end_date)} · {r.value_requested}h
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs text-muted-foreground">Submitted {fmtDate(r.submitted_at.split('T')[0]!)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Recent decisions */}
        {decided.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Recent decisions
            </h2>
            <div className="space-y-2">
              {decided.map(r => {
                const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 opacity-70"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm">
                        {staff ? `${staff.first_name} ${staff.last_name}` : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {TYPE_LABELS[r.type] ?? r.type} · {fmtDate(r.start_date)} – {fmtDate(r.end_date)} · {r.value_requested}h
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  )
}
