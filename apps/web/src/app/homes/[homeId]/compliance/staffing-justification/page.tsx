import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BAND_LABEL } from '@carerota/domain'

export default async function StaffingJustificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { homeId } = await params
  const { date: dateParam } = await searchParams
  const date = dateParam ?? new Date().toISOString().slice(0, 10)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Snapshot on or before the selected date
  const { data: snapshot } = await supabase
    .from('bed_occupancy_snapshots')
    .select('*')
    .eq('home_id', homeId)
    .lte('snapshot_at', date + 'T23:59:59Z')
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Dependency totals from assessments on or before that date
  const { data: assessments } = await supabase
    .from('dependency_assessments')
    .select('resident_id, overall_band, assessment_date')
    .eq('home_id', homeId)
    .lte('assessment_date', date)
    .not('resident_id', 'is', null)
    .order('assessment_date', { ascending: false })

  const depTotals = computeLatestBands(assessments ?? [])
  const totalAssessed = Object.values(depTotals).reduce((s, n) => s + n, 0)

  // Staffing matrices that applied on that date
  const { data: matrices } = await supabase
    .from('staffing_matrices')
    .select('*')
    .eq('home_id', homeId)
    .order('shift_block', { ascending: true })

  // Overrides on that date
  const { data: overrides } = await supabase
    .from('rule_overrides')
    .select('rule_code, reason_category, justification, overridden_at, users!rule_overrides_overridden_by_user_id_fkey(name, email)')
    .eq('home_id', homeId)
    .gte('overridden_at', date + 'T00:00:00Z')
    .lte('overridden_at', date + 'T23:59:59Z')

  return (
    <PageShell title="Staffing Justification">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Link
            href={`/homes/${homeId}/compliance`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Compliance
          </Link>
          <form method="GET">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Date</label>
              <input
                type="date"
                name="date"
                defaultValue={date}
                className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Go</button>
            </div>
          </form>
        </div>

        {/* Occupancy snapshot */}
        <Section title="Occupancy snapshot">
          {snapshot ? (
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <Stat label="Occupied beds" value={String(snapshot.occupied_beds)} />
              <Stat label="Vacant beds" value={String(snapshot.vacant_beds)} />
              <Stat label="Recorded" value={new Date(snapshot.snapshot_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No occupancy data recorded on or before this date.</p>
          )}
        </Section>

        {/* Dependency totals */}
        <Section title={`Dependency totals (${totalAssessed} residents assessed)`}>
          {totalAssessed > 0 ? (
            <div className="grid grid-cols-4 gap-3 text-sm text-center">
              {([
                { band: 'low',        label: 'Low',    colour: 'bg-green-100 text-green-800' },
                { band: 'medium',     label: 'Medium', colour: 'bg-yellow-100 text-yellow-800' },
                { band: 'high',       label: 'High',   colour: 'bg-orange-100 text-orange-800' },
                { band: 'one_to_one', label: '1:1',    colour: 'bg-red-100 text-red-800' },
              ] as const).map(({ band, label, colour }) => (
                <div key={band}>
                  <div className="text-2xl font-bold">{depTotals[band]}</div>
                  <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${colour}`}>{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No dependency assessments recorded on or before this date.</p>
          )}
        </Section>

        {/* Staffing matrix */}
        <Section title="Staffing matrix (active on this date)">
          {matrices && matrices.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <Th>Shift block</Th>
                  <Th>Min carers</Th>
                  <Th>Min seniors</Th>
                  <Th>Min nurses</Th>
                  <Th>Min ancillary</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {matrices.map(m => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 capitalize">{m.shift_block}</td>
                    <td className="px-3 py-2 tabular-nums text-center">{m.min_carers}</td>
                    <td className="px-3 py-2 tabular-nums text-center">{m.min_senior_carers}</td>
                    <td className="px-3 py-2 tabular-nums text-center">{m.min_nurses}</td>
                    <td className="px-3 py-2 tabular-nums text-center">{m.min_ancillary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No staffing matrix configured.</p>
          )}
        </Section>

        {/* Overrides on this date */}
        <Section title="Overrides on this date">
          {overrides && overrides.length > 0 ? (
            <div className="space-y-2">
              {overrides.map(o => {
                const mgr = o.users as { name?: string; email?: string } | null
                return (
                  <div key={o.overridden_at} className="rounded border bg-muted/30 p-3 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{o.rule_code}</code>
                      <span className="text-muted-foreground">by {mgr?.name ?? mgr?.email ?? '—'}</span>
                    </div>
                    <div className="text-muted-foreground">{o.reason_category} — {o.justification}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No overrides recorded on this date.</p>
          )}
        </Section>
      </div>
    </PageShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold mt-0.5">{value}</dd>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{children}</th>
}

function computeLatestBands(
  assessments: { resident_id: string | null; overall_band: string }[],
) {
  const latest = new Map<string, string>()
  for (const a of assessments) {
    if (!a.resident_id || latest.has(a.resident_id)) continue
    latest.set(a.resident_id, a.overall_band)
  }
  const totals = { low: 0, medium: 0, high: 0, one_to_one: 0 }
  for (const band of latest.values()) {
    if (band in totals) totals[band as keyof typeof totals]++
  }
  return totals
}
