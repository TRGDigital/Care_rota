import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { TASettingsClient } from './ta-settings-client'

export default async function TASettingsPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [homeRes, geofenceRes] = await Promise.all([
    supabase
      .from('homes')
      .select('id, tenant_id, no_show_grace_minutes, no_clock_out_hold_minutes, clock_in_early_window_minutes')
      .eq('id', homeId)
      .single(),
    supabase
      .from('geofences')
      .select('id, centre_lat, centre_lng, radius_metres')
      .eq('home_id', homeId)
      .single(),
  ])

  if (!homeRes.data) redirect('/homes')

  return (
    <PageShell title="Time & Attendance settings" description="Geofence, grace windows, and clock-in rules.">
      <TASettingsClient
        homeId={homeId}
        tenantId={homeRes.data.tenant_id}
        noShowGraceMinutes={homeRes.data.no_show_grace_minutes}
        noClockOutHoldMinutes={homeRes.data.no_clock_out_hold_minutes}
        clockInEarlyWindowMinutes={homeRes.data.clock_in_early_window_minutes}
        geofence={geofenceRes.data ?? null}
      />
    </PageShell>
  )
}
