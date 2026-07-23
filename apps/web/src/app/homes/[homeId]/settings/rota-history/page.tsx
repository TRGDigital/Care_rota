import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { RotoHistoryClient } from './rota-history-client'

export default async function RotoHistoryPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Recent import batches
  const { data: recentImports } = await supabase
    .from('rota_history')
    .select('import_batch_id, source_file, created_at')
    .eq('home_id', homeId)
    .order('created_at', { ascending: false })
    .limit(100)

  // Deduplicate by batch
  const batches = [...new Map(
    (recentImports ?? []).map(r => [r.import_batch_id, r])
  ).values()].slice(0, 10)

  // Count rows per batch
  const batchCounts = await Promise.all(
    batches.map(async b => {
      const { count } = await supabase
        .from('rota_history')
        .select('id', { count: 'exact', head: true })
        .eq('import_batch_id', b.import_batch_id)
      return { ...b, count: count ?? 0 }
    })
  )

  return (
    <PageShell title="Historical rota import" description="Upload past rotas as CSV to inform future scheduling.">
      <RotoHistoryClient homeId={homeId} batches={batchCounts} />
    </PageShell>
  )
}
