import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { CreatePeriodButton } from './create-period-button'
import { RebalanceSuggestionsInbox } from './rebalance-suggestions-inbox'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function RotaPeriodsPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const today = new Date().toISOString().split('T')[0]!
  const in14Days = new Date(Date.now() + 14 * 24 * 3_600_000).toISOString().split('T')[0]!

  const [
    { data: periods },
    { data: rebalanceSuggestions },
    { data: openSlots },
  ] = await Promise.all([
    supabase
      .from('rota_periods')
      .select('id, period_start_date, period_end_date, status, published_at')
      .eq('home_id', homeId)
      .order('period_start_date', { ascending: false })
      .limit(20),

    supabase
      .from('rebalance_suggestions')
      .select('id, trigger_type, summary, cost_impact_pence, created_at, status')
      .eq('home_id', homeId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(10),

    // Open shifts in the next 14 days (published periods)
    supabase
      .from('shift_slots')
      .select('id, date, role_code, shift_pattern_templates(name, start_time_local)')
      .eq('home_id', homeId)
      .gte('date', today)
      .lte('date', in14Days)
      .in(
        'rota_period_id',
        (
          await supabase
            .from('rota_periods')
            .select('id')
            .eq('home_id', homeId)
            .eq('status', 'published')
        ).data?.map(p => p.id) ?? []
      )
      .order('date')
      .limit(50),
  ])

  // Find which slots have unassigned shifts
  const slotIdList = (openSlots ?? []).map(s => s.id)
  const { data: unassignedShifts } = slotIdList.length
    ? await supabase
        .from('shifts')
        .select('id, shift_slot_id')
        .in('shift_slot_id', slotIdList)
        .eq('state', 'unassigned')
    : { data: [] }

  const slotsWithOpenShifts = new Set((unassignedShifts ?? []).map(s => s.shift_slot_id))
  const openGaps = (openSlots ?? []).filter(s => slotsWithOpenShifts.has(s.id))

  const hasDraft = (periods ?? []).some(p => p.status === 'draft')

  return (
    <PageShell
      title="Rota board"
      description="Weekly rota periods"
      action={<CreatePeriodButton homeId={homeId} disabled={hasDraft} />}
    >
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Periods list ── */}
        <div className="col-span-2 space-y-2">
          {(!periods || periods.length === 0) && (
            <div className="text-center py-12 border rounded-lg bg-muted/20 text-sm text-muted-foreground">
              No rota periods yet. Set up your{' '}
              <Link href={`/homes/${homeId}/settings/rota`} className="text-primary underline">
                rota settings
              </Link>{' '}
              then create the first period.
            </div>
          )}

          {(periods ?? []).map(p => (
            <Link
              key={p.id}
              href={`/homes/${homeId}/rota/${p.id}`}
              className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div>
                <div className="font-medium text-sm">
                  {fmtDate(p.period_start_date)} – {fmtDate(p.period_end_date)}
                </div>
                {p.published_at && (
                  <div className="text-xs text-muted-foreground">Published {fmtDate(p.published_at.split('T')[0]!)}</div>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[p.status] ?? STATUS_STYLES.draft}`}>
                {p.status}
              </span>
            </Link>
          ))}
        </div>

        {/* ── Sidebar ── */}
        <div className="col-span-1 space-y-4">
          {/* Rebalance suggestions */}
          <RebalanceSuggestionsInbox
            homeId={homeId}
            suggestions={rebalanceSuggestions ?? []}
          />

          {/* Open shifts in next 14 days */}
          <div className="bg-card border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">
              Open shifts — next 14 days
              {openGaps.length > 0 && (
                <span className="ml-2 text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                  {openGaps.length}
                </span>
              )}
            </h3>

            {openGaps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open gaps — rota is fully covered.</p>
            ) : (
              <div className="space-y-1">
                {openGaps.slice(0, 10).map(s => {
                  const tmpl = Array.isArray(s.shift_pattern_templates)
                    ? s.shift_pattern_templates[0]
                    : s.shift_pattern_templates
                  return (
                    <div key={s.id} className="text-xs flex items-center justify-between py-1 border-b last:border-0">
                      <div>
                        <span className="font-medium">{fmtDate(s.date)}</span>
                        <span className="text-muted-foreground ml-1">{s.role_code}</span>
                      </div>
                      <span className="text-muted-foreground">{tmpl?.start_time_local?.slice(0, 5) ?? '—'}</span>
                    </div>
                  )
                })}
                {openGaps.length > 10 && (
                  <p className="text-xs text-muted-foreground pt-1">+{openGaps.length - 10} more gaps…</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
