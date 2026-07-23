import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { formatPence } from '@/lib/utils'
import {
  PoundSterling, BedDouble, TrendingUp, Users,
  AlertTriangle, Calendar, FileWarning, Clock, Sparkles,
} from 'lucide-react'

export default async function OwnerDashboardPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // For owner dashboards we show cross-home stats.
  // First get all homes in the same organisation.
  const { data: homeRow } = await supabase
    .from('homes')
    .select('organisation_id, bed_capacity')
    .eq('id', homeId)
    .single()

  const { data: orgHomes } = await supabase
    .from('homes')
    .select('id, name, bed_capacity')
    .eq('organisation_id', homeRow?.organisation_id ?? '')
    .order('name')

  const homeIds = (orgHomes ?? []).map(h => h.id)

  // Month-to-date window
  const firstOfMonth = new Date()
  firstOfMonth.setDate(1); firstOfMonth.setHours(0, 0, 0, 0)
  const monthStart = firstOfMonth.toISOString()

  // 1. Total payroll cost MTD per home
  const { data: payslipsMtd } = homeIds.length > 0
    ? await supabase
        .from('payslips')
        .select('home_id, gross_total_pence')
        .in('home_id', homeIds)
        .gte('created_at', monthStart)
    : { data: [] }

  const payrollByHome = new Map<string, number>()
  for (const p of payslipsMtd ?? []) {
    payrollByHome.set(p.home_id, (payrollByHome.get(p.home_id) ?? 0) + p.gross_total_pence)
  }
  const totalPayrollMtd = [...payrollByHome.values()].reduce((a, b) => a + b, 0)

  // 2. Savings to date (MTD)
  const { data: savingsMtdRows } = homeIds.length > 0
    ? await supabase
        .from('cost_savings_log')
        .select('home_id, savings_pence')
        .in('home_id', homeIds)
        .gte('recorded_at', monthStart)
    : { data: [] }

  const totalSavingsMtd = (savingsMtdRows ?? []).reduce((a, r) => a + Number(r.savings_pence), 0)

  // 3. Latest occupancy per home
  const { data: occupancyRows } = homeIds.length > 0
    ? await supabase
        .from('bed_occupancy_snapshots')
        .select('home_id, occupied_beds, snapshot_at')
        .in('home_id', homeIds)
        .order('snapshot_at', { ascending: false })
    : { data: [] }

  const latestOccByHome = new Map<string, number>()
  for (const r of occupancyRows ?? []) {
    if (!latestOccByHome.has(r.home_id)) latestOccByHome.set(r.home_id, r.occupied_beds)
  }
  const totalOccupied = [...latestOccByHome.values()].reduce((a, b) => a + b, 0)
  const totalCapacity = (orgHomes ?? []).reduce((a, h) => a + h.bed_capacity, 0)

  // 4. Open shifts in next 7 days
  const sevenDaysOut = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const { count: openShifts } = homeIds.length > 0
    ? await supabase
        .from('shifts')
        .select('*', { count: 'exact', head: true })
        .in('home_id', homeIds)
        .eq('state', 'unassigned')
        .gte('planned_start_utc', new Date().toISOString())
        .lte('planned_start_utc', sevenDaysOut)
    : { count: 0 }

  // 5. Training expiring in next 30 days
  const thirtyDaysOut = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const { count: trainingExpiring } = homeIds.length > 0
    ? await supabase
        .from('staff_training_certs')
        .select('*', { count: 'exact', head: true })
        .in('home_id', homeIds)
        .lt('expiry_date', thirtyDaysOut)
        .gte('expiry_date', new Date().toISOString().slice(0, 10))
    : { count: 0 }

  // 6. Manager overrides last 30 days per home
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { count: totalOverrides } = homeIds.length > 0
    ? await supabase
        .from('rule_overrides')
        .select('*', { count: 'exact', head: true })
        .in('home_id', homeIds)
        .gte('overridden_at', thirtyDaysAgo)
    : { count: 0 }

  // 7. Outstanding leave requests
  const { count: pendingLeave } = homeIds.length > 0
    ? await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .in('home_id', homeIds)
        .eq('status', 'pending')
    : { count: 0 }

  // Cost per occupied bed MTD
  const costPerBedMtd = totalOccupied > 0
    ? Math.round(totalPayrollMtd / totalOccupied)
    : 0

  // Overtime %  — quick proxy: overtime payslip lines / gross total
  const { data: overtimeLines } = homeIds.length > 0
    ? await supabase
        .from('payslip_lines')
        .select('amount_pence')
        .in('home_id', homeIds)
        .eq('line_type', 'overtime')
        .gte('created_at', monthStart)
    : { data: [] }

  const totalOvertime = (overtimeLines ?? []).reduce((a, l) => a + l.amount_pence, 0)
  const overtimePct = totalPayrollMtd > 0 ? ((totalOvertime / totalPayrollMtd) * 100).toFixed(1) : '0.0'

  return (
    <PageShell
      title="Owner Dashboard"
      description={`${orgHomes?.length ?? 1} home${(orgHomes?.length ?? 1) !== 1 ? 's' : ''} · ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
    >
      <div className="space-y-6">
        {/* Savings hero tile */}
        {totalSavingsMtd > 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-4">
            <Sparkles className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-900">
                CareRota has saved you {formatPence(totalSavingsMtd)} this month
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                From occupancy rebalancing, no-shows, and training overlap optimisation
              </p>
            </div>
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <KpiCard
            icon={<PoundSterling className="h-4 w-4" />}
            label="Payroll cost MTD"
            value={formatPence(totalPayrollMtd)}
            sub={`${(orgHomes ?? []).length} homes`}
            href={`/homes/${homeId}/pay-runs`}
          />
          <KpiCard
            icon={<PoundSterling className="h-4 w-4" />}
            label="Cost per occupied bed"
            value={formatPence(costPerBedMtd)}
            sub="this month"
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Overtime %"
            value={`${overtimePct}%`}
            sub="of payroll this month"
            warn={parseFloat(overtimePct) > 10}
          />
          <KpiCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Savings MTD"
            value={formatPence(totalSavingsMtd)}
            sub="from cost guard"
            highlight
          />
          <KpiCard
            icon={<BedDouble className="h-4 w-4" />}
            label="Occupancy"
            value={totalCapacity > 0 ? `${totalOccupied} / ${totalCapacity}` : '—'}
            sub={`${totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0}% occupied`}
            href={`/homes/${homeId}/occupancy`}
          />
          <KpiCard
            icon={<Calendar className="h-4 w-4" />}
            label="Open shifts (7d)"
            value={String(openShifts ?? 0)}
            sub="need cover"
            warn={(openShifts ?? 0) > 5}
            href={`/homes/${homeId}/rota`}
          />
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Training expiring (30d)"
            value={String(trainingExpiring ?? 0)}
            sub="certifications"
            warn={(trainingExpiring ?? 0) > 0}
            href={`/homes/${homeId}/compliance/training`}
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Overrides (30d)"
            value={String(totalOverrides ?? 0)}
            sub="manager overrides"
            warn={(totalOverrides ?? 0) > 20}
            href={`/homes/${homeId}/compliance/override-log`}
          />
          <KpiCard
            icon={<FileWarning className="h-4 w-4" />}
            label="Pending leave"
            value={String(pendingLeave ?? 0)}
            sub="awaiting approval"
            warn={(pendingLeave ?? 0) > 0}
            href={`/homes/${homeId}/leave`}
          />
        </div>

        {/* Per-home breakdown */}
        {(orgHomes?.length ?? 0) > 1 && (
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30">
              <p className="text-sm font-medium">Payroll by home — MTD</p>
            </div>
            <div className="divide-y">
              {(orgHomes ?? []).map(h => {
                const cost = payrollByHome.get(h.id) ?? 0
                const occ = latestOccByHome.get(h.id) ?? 0
                return (
                  <Link
                    key={h.id}
                    href={`/homes/${h.id}/dashboards/owner`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">{h.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {occ} / {h.bed_capacity} beds
                      </div>
                    </div>
                    <div className="text-sm font-mono font-medium">
                      {formatPence(cost)}
                    </div>
                    <div className="text-xs text-muted-foreground w-16 text-right">
                      {occ > 0 && cost > 0 ? `${formatPence(Math.round(cost / occ))}/bed` : '—'}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

function KpiCard({
  icon, label, value, sub, href, warn, highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  href?: string
  warn?: boolean
  highlight?: boolean
}) {
  const card = (
    <div className={`rounded-lg border p-4 space-y-1 transition-colors ${
      highlight ? 'bg-primary/5 border-primary/20' :
      warn ? 'bg-amber-50 border-amber-200' :
      'bg-card hover:bg-muted/20'
    } ${href ? 'cursor-pointer' : ''}`}>
      <div className={`text-xs font-medium flex items-center gap-1.5 ${
        highlight ? 'text-primary' : warn ? 'text-amber-700' : 'text-muted-foreground'
      }`}>
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-primary' : warn ? 'text-amber-800' : ''}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  )

  return href ? <Link href={href}>{card}</Link> : card
}
