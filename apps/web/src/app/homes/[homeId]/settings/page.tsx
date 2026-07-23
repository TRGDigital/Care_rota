import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { HolidayUnitSetting } from './holiday-unit-setting'

export default async function SettingsPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: home } = await supabase
    .from('homes')
    .select('id, name, time_zone, holiday_allocation_unit')
    .eq('id', homeId)
    .single()

  if (!home) redirect('/homes')

  const { count: leaveCount } = await supabase
    .from('leave_requests')
    .select('id', { count: 'exact', head: true })
    .eq('home_id', homeId)

  const hasLeaveRequests = (leaveCount ?? 0) > 0

  return (
    <PageShell title="Settings" description="Home configuration.">
      <div className="max-w-lg space-y-8 mt-6">
        <section className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">General</h2>
          <div className="bg-card border rounded-lg divide-y">
            <Row label="Home name" value={home.name} />
            <Row label="Time zone" value={home.time_zone} />
          </div>
        </section>

        <section className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Holiday allocation
          </h2>
          <HolidayUnitSetting
            homeId={homeId}
            currentUnit={(home.holiday_allocation_unit ?? 'hours') as 'days' | 'hours'}
            hasLeaveRequests={hasLeaveRequests}
          />
        </section>

        <section className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Staff & Rota</h2>
          <div className="bg-card border rounded-lg divide-y">
            <NavRow href={`/homes/${homeId}/settings/rota`} label="Rota settings" description="Period length, start day, standard slot requirements" />
            <NavRow href={`/homes/${homeId}/settings/shift-patterns`} label="Shift patterns" description="Reusable shift templates for rota building" />
            <NavRow href={`/homes/${homeId}/settings/training-matrix`} label="Training matrix" description="Required topics and renewal intervals" />
            <NavRow href={`/homes/${homeId}/settings/premium-pay`} label="Premium pay calendar" description="Bank holidays and enhanced rate dates" />
            <NavRow href={`/homes/${homeId}/settings/rota-history`} label="Historical rota import" description="Upload past rotas as CSV" />
          </div>
        </section>

        <section className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Occupancy</h2>
          <div className="bg-card border rounded-lg divide-y">
            <NavRow href={`/homes/${homeId}/settings/beds`} label="Beds" description="Define and manage bed inventory" />
            <NavRow href={`/homes/${homeId}/settings/staffing-matrix`} label="Staffing matrix" description="Minimum headcount per dependency band" />
          </div>
        </section>

        <section className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Time &amp; Attendance</h2>
          <div className="bg-card border rounded-lg divide-y">
            <NavRow href={`/homes/${homeId}/settings/kiosks`} label="Kiosks" description="Pair and manage iPad kiosks for on-site clock-in" />
            <NavRow href={`/homes/${homeId}/settings/time-attendance`} label="T&amp;A settings" description="Geofence, grace windows, and clock-in rules" />
          </div>
        </section>

        <section className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Payroll</h2>
          <div className="bg-card border rounded-lg divide-y">
            <NavRow href={`/homes/${homeId}/settings/payroll`} label="Pay cycle" description="Frequency, pay day rule, and period start offset" />
            <NavRow href={`/homes/${homeId}/settings/payroll/statutory-rates`} label="Statutory rates" description="NMW/NLW floors by age band and effective date" />
          </div>
        </section>

        <section className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Integrations</h2>
          <div className="bg-card border rounded-lg divide-y">
            <NavRow href={`/homes/${homeId}/settings/integrations/carestream`} label="CareStream" description="Import occupancy and dependency from CareStream" />
          </div>
        </section>
      </div>
    </PageShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  )
}

function NavRow({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  )
}
