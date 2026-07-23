import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { formatPence } from '@/lib/utils'
import { runCostGuard } from '@carerota/domain/server'
import { CostGuardPanel } from './cost-guard-panel'

export default async function DashboardsPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Savings to date (MTD)
  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)

  const { data: savingsRows } = await supabase
    .from('cost_savings_log')
    .select('savings_pence, source')
    .eq('home_id', homeId)
    .gte('recorded_at', firstOfMonth.toISOString())

  const savingsMtd = savingsRows?.reduce((sum, r) => sum + Number(r.savings_pence), 0) ?? 0

  // Latest occupancy
  const { data: snapshot } = await supabase
    .from('bed_occupancy_snapshots')
    .select('occupied_beds, vacant_beds, snapshot_at')
    .eq('home_id', homeId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Dependency totals from latest assessment per resident
  const { data: assessments } = await supabase
    .from('dependency_assessments')
    .select('overall_band, resident_id, assessment_date')
    .eq('home_id', homeId)
    .not('resident_id', 'is', null)
    .order('assessment_date', { ascending: false })

  const depTotals = computeLatestBands(assessments ?? [])

  // Override count (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { count: overrideCount } = await supabase
    .from('rule_overrides')
    .select('*', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .gte('overridden_at', thirtyDaysAgo)

  // Cost guard suggestions
  const suggestion = await runCostGuard(supabase, homeId)
  const costGuardProps = suggestion
    ? {
        occupiedBeds: suggestion.occupiedBeds,
        totalSavingsPence: Number(suggestion.totalSavingsPence),
        proposedCuts: suggestion.proposedCuts.map(c => ({
          ...c,
          savingsPence: Number(c.savingsPence),
        })),
      }
    : null

  return (
    <PageShell title="Dashboards">
      <div className="space-y-6">
        {costGuardProps && (
          <CostGuardPanel
            homeId={homeId}
            occupiedBeds={costGuardProps.occupiedBeds}
            proposedCuts={costGuardProps.proposedCuts}
            totalSavingsPence={costGuardProps.totalSavingsPence}
          />
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Savings this month"
            value={formatPence(savingsMtd)}
            sub="from occupancy rebalancing"
            highlight
          />
          <StatCard
            label="Current occupancy"
            value={snapshot ? `${snapshot.occupied_beds} / ${snapshot.occupied_beds + snapshot.vacant_beds}` : '—'}
            sub={snapshot ? `${snapshot.vacant_beds} vacant` : 'No data yet'}
          />
          <StatCard
            label="High dependency"
            value={String(depTotals.high + depTotals.one_to_one)}
            sub={`${depTotals.one_to_one} one-to-one`}
          />
          <StatCard
            label="Overrides (30d)"
            value={String(overrideCount ?? 0)}
            sub="manager overrides recorded"
          />
        </div>

        {/* Dependency breakdown */}
        {Object.values(depTotals).some(v => v > 0) && (
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <h2 className="text-sm font-medium">Dependency breakdown</h2>
            <div className="grid grid-cols-4 gap-3 text-center">
              {([
                { band: 'low',        label: 'Low',      colour: 'bg-green-100 text-green-800' },
                { band: 'medium',     label: 'Medium',   colour: 'bg-yellow-100 text-yellow-800' },
                { band: 'high',       label: 'High',     colour: 'bg-orange-100 text-orange-800' },
                { band: 'one_to_one', label: '1:1',      colour: 'bg-red-100 text-red-800' },
              ] as const).map(({ band, label, colour }) => (
                <div key={band}>
                  <div className="text-2xl font-bold">{depTotals[band]}</div>
                  <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${colour}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          <div className="font-medium text-foreground mb-1">Payroll tiles</div>
          Available in Sprint 6 — payroll cost MTD, overtime %, agency spend
        </div>
      </div>
    </PageShell>
  )
}

function StatCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      <div className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
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
