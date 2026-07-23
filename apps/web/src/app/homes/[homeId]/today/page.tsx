import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { OccupancyTile } from './occupancy-tile'

export default async function TodayPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Latest occupancy snapshot
  const { data: latestSnapshot } = await supabase
    .from('bed_occupancy_snapshots')
    .select('*')
    .eq('home_id', homeId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Total active bed count
  const { count: totalBeds } = await supabase
    .from('beds')
    .select('*', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .neq('status', 'maintenance')

  // Days since last snapshot (for staleness warning)
  const daysSinceSnapshot = latestSnapshot
    ? Math.floor((Date.now() - new Date(latestSnapshot.snapshot_at).getTime()) / 86_400_000)
    : null

  return (
    <PageShell title="Today">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <OccupancyTile
          homeId={homeId}
          totalBeds={totalBeds ?? 0}
          latestSnapshot={latestSnapshot}
          daysSinceSnapshot={daysSinceSnapshot}
        />
        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground col-span-1">
          <div className="font-medium text-foreground mb-1">Shift overview</div>
          Coming in Sprint 5 — live clocking status
        </div>
      </div>
    </PageShell>
  )
}
