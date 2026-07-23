import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { OccupancyClient } from './occupancy-client'

export default async function OccupancyPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: home } = await supabase
    .from('homes')
    .select('name, bed_capacity')
    .eq('id', homeId)
    .single()

  // Last 30 snapshots
  const { data: snapshots } = await supabase
    .from('bed_occupancy_snapshots')
    .select('id, snapshot_at, occupied_beds, vacant_beds, expected_admissions_next_7_days, expected_discharges_next_7_days, source')
    .eq('home_id', homeId)
    .order('snapshot_at', { ascending: false })
    .limit(30)

  const bedCapacity = home?.bed_capacity ?? 40

  return (
    <PageShell
      title="Bed Occupancy"
      description="Record and track bed occupancy. Used by the cost guard to suggest rota adjustments."
    >
      <OccupancyClient
        homeId={homeId}
        bedCapacity={bedCapacity}
        snapshots={snapshots ?? []}
      />
    </PageShell>
  )
}
