import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { KiosksClient } from './kiosks-client'

export default async function KiosksPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: kiosks } = await supabase
    .from('kiosks')
    .select('id, name, is_active, paired_at, last_seen_at, location_description')
    .eq('home_id', homeId)
    .order('name')

  return (
    <PageShell title="Kiosks" description="Manage iPad kiosks for on-site clock-in.">
      <KiosksClient homeId={homeId} initialKiosks={kiosks ?? []} />
    </PageShell>
  )
}
