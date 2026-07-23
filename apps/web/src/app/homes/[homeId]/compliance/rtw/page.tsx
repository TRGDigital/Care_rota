import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle, Clock } from 'lucide-react'

export default async function RtwPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const sixtyDaysOut = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)

  // RTW documents (passport, BRP, share code) expiring within 60 days or already expired
  const { data: docs } = await supabase
    .from('staff_documents')
    .select(`
      id, doc_type, expiry_date, document_number,
      staff!inner ( id, first_name, last_name, status )
    `)
    .eq('home_id', homeId)
    .in('doc_type', ['passport', 'biometric_residence_permit', 'share_code'])
    .not('expiry_date', 'is', null)
    .lte('expiry_date', sixtyDaysOut)
    .order('expiry_date', { ascending: true })

  type StaffJoin = { id: string; first_name: string; last_name: string; status: string }
  const expiries = (docs ?? []).filter(d => {
    const s = d.staff as StaffJoin | null
    return s?.status === 'active'
  })

  const today = new Date().toISOString().slice(0, 10)

  return (
    <PageShell
      title="Right to Work Pipeline"
      description="Staff with right-to-work documents expiring within 60 days."
    >
      <div className="space-y-5 max-w-2xl">
        <Link
          href={`/homes/${homeId}/compliance`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Compliance
        </Link>

        {expiries.length === 0 ? (
          <div className="rounded-lg border bg-green-50 border-green-200 px-4 py-6 text-center">
            <p className="text-sm text-green-800 font-medium">No RTW documents expiring in the next 60 days.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-muted-foreground">
                {expiries.length} document{expiries.length !== 1 ? 's' : ''} expiring or expired
              </span>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Staff</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Document</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Expires</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expiries.map(doc => {
                    const s = doc.staff as StaffJoin | null
                    const daysLeft = Math.ceil((new Date(doc.expiry_date!).getTime() - Date.now()) / 86_400_000)
                    const isExpired = doc.expiry_date! < today
                    return (
                      <tr key={doc.id} className={`hover:bg-muted/30 ${isExpired ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 font-medium">
                          {s?.first_name} {s?.last_name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {doc.doc_type.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {new Date(doc.expiry_date!).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">
                              <AlertTriangle className="h-3 w-3" /> Expired
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                              daysLeft <= 14 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              <Clock className="h-3 w-3" /> {daysLeft}d left
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s && (
                            <Link
                              href={`/homes/${homeId}/staff/${s.id}?tab=documents`}
                              className="text-xs text-primary underline"
                            >
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
