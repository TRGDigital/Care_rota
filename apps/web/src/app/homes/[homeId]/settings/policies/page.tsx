import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PolicyUploadForm } from './upload-form'
import { deletePolicyDocument } from './actions'

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: docs } = await supabase
    .from('policy_documents')
    .select('id, filename, status, chunk_count, file_size_bytes, created_at')
    .eq('home_id', homeId)
    .order('created_at', { ascending: false })

  return (
    <PageShell title="Policies & Documents">
      <div className="space-y-6 max-w-2xl">
        <Link
          href={`/homes/${homeId}/settings`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Settings
        </Link>

        <div>
          <h2 className="text-sm font-semibold mb-1">Upload a policy document</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Uploaded documents are indexed so the chat assistant can answer questions like
            "What&apos;s our procedure for reporting sickness?"
          </p>
          <PolicyUploadForm homeId={homeId} />
        </div>

        {docs && docs.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Uploaded documents</h2>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">File</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Chunks</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Size</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {docs.map(doc => (
                    <tr key={doc.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium truncate max-w-[200px]">{doc.filename}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          doc.status === 'indexed'     ? 'bg-green-100 text-green-800' :
                          doc.status === 'error'       ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{doc.chunk_count ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {doc.file_size_bytes ? `${Math.round(doc.file_size_bytes / 1024)} KB` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <form action={deletePolicyDocument.bind(null, homeId, doc.id)}>
                          <button
                            type="submit"
                            className="text-xs text-destructive hover:underline"
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
