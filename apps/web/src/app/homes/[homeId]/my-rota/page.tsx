import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
}

export default async function MyRotaPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Find staff record for this user
  const { data: staffRecord } = await supabase
    .from('staff')
    .select('id, first_name, last_name')
    .eq('home_id', homeId)
    .eq('user_id', user.id)
    .maybeSingle()

  const fourWeeksAhead = new Date()
  fourWeeksAhead.setDate(fourWeeksAhead.getDate() + 28)
  const today = new Date().toISOString().split('T')[0]!
  const until = fourWeeksAhead.toISOString().split('T')[0]!

  // Fetch published shifts for this staff member
  const shifts = staffRecord
    ? (await supabase
        .from('shifts')
        .select('id, planned_start_utc, planned_end_utc, planned_paid_hours, is_bank_holiday, is_christmas_period, premium_multiplier, shift_slot_id')
        .eq('staff_id', staffRecord.id)
        .eq('home_id', homeId)
        .gte('planned_start_utc', today)
        .lte('planned_start_utc', until)
        .not('state', 'in', '("cancelled","no_show")')
        .in(
          'shift_slot_id',
          (await supabase
            .from('shift_slots')
            .select('id, rota_period_id')
            .in(
              'rota_period_id',
              (await supabase
                .from('rota_periods')
                .select('id')
                .eq('home_id', homeId)
                .eq('status', 'published')
              ).data?.map(p => p.id) ?? []
            )
          ).data?.map(s => s.id) ?? []
        )
        .order('planned_start_utc')
      ).data ?? []
    : []

  // Group by date
  const grouped = shifts.reduce<Record<string, typeof shifts>>((acc, s) => {
    const date = s.planned_start_utc.split('T')[0]!
    if (!acc[date]) acc[date] = []
    acc[date]!.push(s)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort()

  return (
    <PageShell title="My rota" description="Your published shifts for the next 4 weeks.">
      <div className="max-w-lg mt-6 space-y-3">
        {!staffRecord && (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg bg-muted/20">
            No staff record linked to your account. Contact your manager.
          </div>
        )}

        {staffRecord && shifts.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg bg-muted/20">
            No published shifts in the next 4 weeks.
          </div>
        )}

        {sortedDates.map(date => (
          <div key={date} className="bg-card border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground">
              {fmtDay(date)}
            </div>
            <div className="divide-y">
              {grouped[date]!.map(s => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">
                      {fmtTime(s.planned_start_utc)} – {fmtTime(s.planned_end_utc)}
                    </div>
                    <div className="text-xs text-muted-foreground">{Number(s.planned_paid_hours)}h paid</div>
                  </div>
                  <div className="text-right">
                    {s.is_christmas_period && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Christmas {s.premium_multiplier}×</span>}
                    {s.is_bank_holiday && !s.is_christmas_period && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Bank holiday {s.premium_multiplier}×</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
