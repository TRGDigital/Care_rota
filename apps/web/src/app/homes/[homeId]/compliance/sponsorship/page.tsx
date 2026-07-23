import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

export default async function SponsorshipPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: sponsorships } = await supabase
    .from('staff_sponsorship')
    .select(`
      id, cos_reference, cos_start_date, cos_end_date,
      minimum_hours_per_week, route,
      staff!inner ( id, first_name, last_name, status )
    `)
    .eq('home_id', homeId)
    .order('cos_end_date', { ascending: true })

  // Get current week shifts for each sponsored worker
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000)

  type StaffJoin = { id: string; first_name: string; last_name: string; status: string }
  const activeSponsors = (sponsorships ?? []).filter(s => (s.staff as StaffJoin | null)?.status === 'active')
  const staffIds = activeSponsors.map(s => (s.staff as StaffJoin).id)

  const { data: weekShifts } = staffIds.length > 0
    ? await supabase
        .from('shifts')
        .select('staff_id, planned_paid_hours')
        .in('staff_id', staffIds)
        .eq('home_id', homeId)
        .gte('planned_start_utc', weekStart.toISOString())
        .lt('planned_start_utc', weekEnd.toISOString())
        .in('state', ['assigned', 'completed'])
    : { data: [] }

  const hoursMap = new Map<string, number>()
  for (const shift of weekShifts ?? []) {
    if (!shift.staff_id) continue
    hoursMap.set(shift.staff_id, (hoursMap.get(shift.staff_id) ?? 0) + shift.planned_paid_hours)
  }

  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysOut = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

  return (
    <PageShell
      title="Sponsorship Hours Floor"
      description="Sponsored workers — CoS minimum hours vs current week rota hours."
    >
      <div className="space-y-5 max-w-3xl">
        <Link
          href={`/homes/${homeId}/compliance`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Compliance
        </Link>

        {activeSponsors.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">No sponsored workers found.</p>
          </div>
        ) : (
          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Staff</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">CoS ref</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase">Min hrs/wk</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase">This week</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">CoS expires</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeSponsors.map(sp => {
                  const s = sp.staff as StaffJoin
                  const weekHours = hoursMap.get(s.id) ?? 0
                  const minHours = sp.minimum_hours_per_week
                  const isAtRisk = weekHours < minHours && weekHours > minHours * 0.8
                  const isBreach = weekHours < minHours * 0.8
                  const cosExpired = sp.cos_end_date < today
                  const cosExpiringSoon = !cosExpired && sp.cos_end_date <= thirtyDaysOut

                  return (
                    <tr key={sp.id} className={`hover:bg-muted/30 ${isBreach ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/homes/${homeId}/staff/${s.id}`} className="hover:underline">
                          {s.first_name} {s.last_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{sp.cos_reference}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{minHours}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{weekHours.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        {isBreach ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">
                            <AlertTriangle className="h-3 w-3" /> Breach
                          </span>
                        ) : isAtRisk ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                            <Clock className="h-3 w-3" /> At risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={
                          cosExpired ? 'text-red-700 font-medium' :
                          cosExpiringSoon ? 'text-amber-700 font-medium' :
                          'text-muted-foreground'
                        }>
                          {new Date(sp.cos_end_date).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                          {cosExpired && ' (expired)'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Breach = current week rota hours below 80% of CoS minimum. At risk = 80–99%.
          Hours shown are from assigned and completed shifts this week ({weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – {weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}).
        </p>
      </div>
    </PageShell>
  )
}
