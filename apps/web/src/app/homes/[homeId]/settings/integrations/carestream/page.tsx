import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { CsvImportForm } from './csv-import-form'

export default async function CareStreamIntegrationPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Last import info
  const { data: lastImport } = await supabase
    .from('dependency_assessments')
    .select('created_at')
    .eq('home_id', homeId)
    .eq('source', 'imported_from_carestream')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <PageShell title="CareStream Integration">
      <div className="space-y-6 max-w-2xl">
        <Link
          href={`/homes/${homeId}/settings`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Settings
        </Link>

        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <h2 className="font-medium">Pattern 1 — Manual CSV import</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Export the resident list from CareStream and upload here. Takes about 30 seconds.
              Always available — no API connection required.
            </p>
          </div>

          {lastImport && (
            <p className="text-xs text-muted-foreground">
              Last imported: {new Date(lastImport.created_at).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}

          <CsvImportForm homeId={homeId} />

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">CSV format reference</summary>
            <div className="mt-2 rounded border bg-muted p-3 font-mono">
              resident_external_ref,first_name,last_name_initial,room_number,dependency_band,assessment_date<br />
              CS-001,Margaret,S,14,high,2026-05-01<br />
              CS-002,Arthur,B,7,medium,2026-04-28<br />
            </div>
            <p className="mt-2">
              <strong>dependency_band</strong> values: <code>low</code>, <code>medium</code>, <code>high</code>, <code>one_to_one</code>
            </p>
          </details>
        </div>

        <div className="rounded-lg border bg-card p-5 space-y-2 opacity-60">
          <h2 className="font-medium">Pattern 2 — API sync</h2>
          <p className="text-sm text-muted-foreground">
            Automatic 15-minute sync via service-to-service token.
            Available in v2 — use CSV import for now.
          </p>
          <button disabled className="rounded-md border px-3 py-1.5 text-sm opacity-50 cursor-not-allowed">
            Connect CareStream (coming in v2)
          </button>
        </div>
      </div>
    </PageShell>
  )
}
