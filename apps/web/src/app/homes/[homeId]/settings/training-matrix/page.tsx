import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { TrainingMatrixClient } from './training-matrix-client'

export default async function TrainingMatrixPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: topics } = await supabase
    .from('training_topics')
    .select('id, code, name, renewal_interval_months, enforcement_mode')
    .eq('home_id', homeId)
    .order('name')

  return (
    <PageShell title="Training matrix" description="Required training topics and renewal intervals for this home.">
      <TrainingMatrixClient homeId={homeId} initialTopics={topics ?? []} />
    </PageShell>
  )
}
