import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { RotaSettingsClient } from './rota-settings-client'
import { POSITIONS } from '../../import/positions'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function RotaSettingsPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: home } = await supabase
    .from('homes')
    .select('rota_period_weeks, rota_start_day')
    .eq('id', homeId)
    .single()

  const { data: requirements } = await supabase
    .from('rota_slot_requirements')
    .select('id, day_of_week, role_code, headcount_required, shift_pattern_template_id, shift_pattern_templates(name)')
    .eq('home_id', homeId)
    .order('day_of_week')
    .order('role_code')

  const { data: patternsData } = await supabase
    .from('shift_pattern_templates')
    .select('id, name, start_time_local, end_time_local, paid_hours_decimal')
    .eq('home_id', homeId)
    .order('start_time_local')
  const patterns = (patternsData ?? []).map(p => ({
    id: p.id,
    name: p.name,
    start: String(p.start_time_local).slice(0, 5),
    end: String(p.end_time_local).slice(0, 5),
    hours: Number(p.paid_hours_decimal),
  }))

  return (
    <PageShell title="Rota settings" description="Period configuration and standard weekly slot requirements.">
      <RotaSettingsClient
        homeId={homeId}
        periodWeeks={home?.rota_period_weeks ?? 1}
        startDay={home?.rota_start_day ?? 1}
        requirements={requirements ?? []}
        patterns={patterns}
        positions={POSITIONS}
        days={DAYS}
      />
    </PageShell>
  )
}
