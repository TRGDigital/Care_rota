import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { PhotoReviewClient } from './photo-review-client'

export default async function PhotoReviewPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Today's 5-photo spot check: pick 5 unreviewed photos from the last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: clockings } = await supabase
    .from('shift_clockings')
    .select(`
      id, event_type, event_time_utc, capture_method, photo_url, requires_review,
      staff!inner ( id, first_name, last_name, photo_url )
    `)
    .eq('home_id', homeId)
    .gte('event_time_utc', since)
    .not('photo_url', 'is', null)
    .is('reviewed_at', null)
    .order('event_time_utc', { ascending: false })
    .limit(5)

  return (
    <PageShell
      title="Photo review"
      description="Daily 5-photo spot check. Review each punch photo to catch buddy-punching."
    >
      <PhotoReviewClient homeId={homeId} clockings={clockings ?? []} />
    </PageShell>
  )
}
