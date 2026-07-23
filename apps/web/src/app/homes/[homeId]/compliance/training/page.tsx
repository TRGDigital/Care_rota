import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const THIRTY_DAYS_MS = 30 * 86_400_000

function certStatus(expiryDate: string | null): 'expired' | 'expiring' | 'valid' | 'missing' {
  if (!expiryDate) return 'missing'
  const exp = new Date(expiryDate).getTime()
  const now = Date.now()
  if (exp < now) return 'expired'
  if (exp < now + THIRTY_DAYS_MS) return 'expiring'
  return 'valid'
}

const STATUS_STYLE: Record<string, string> = {
  valid:    'bg-green-100 text-green-800',
  expiring: 'bg-amber-100 text-amber-800',
  expired:  'bg-red-100 text-red-800',
  missing:  'bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<string, string> = {
  valid: '✓', expiring: '!', expired: '✗', missing: '—',
}

export default async function TrainingMatrixPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: topics }, { data: staff }, { data: certs }] = await Promise.all([
    supabase
      .from('training_topics')
      .select('id, code, name, enforcement_mode, renewal_interval_months')
      .eq('home_id', homeId)
      .order('enforcement_mode', { ascending: true })
      .order('name'),
    supabase
      .from('staff')
      .select('id, first_name, last_name')
      .eq('home_id', homeId)
      .eq('status', 'active')
      .order('last_name'),
    supabase
      .from('staff_training_certs')
      .select('staff_id, training_topic_id, expiry_date')
      .eq('home_id', homeId),
  ])

  // Build lookup: staffId → topicId → latest cert
  type Cert = { staff_id: string; training_topic_id: string; expiry_date: string | null }
  const certMap = new Map<string, Cert>()
  for (const c of (certs ?? []) as unknown as Cert[]) {
    const key = `${c.staff_id}:${c.training_topic_id}`
    const existing = certMap.get(key)
    if (!existing || (c.expiry_date ?? '') > (existing.expiry_date ?? '')) {
      certMap.set(key, c)
    }
  }

  const allStaff = staff ?? []
  const allTopics = topics ?? []

  // Summary counts
  let expired = 0, expiring = 0, missing = 0
  for (const s of allStaff) {
    for (const t of allTopics.filter(t => t.enforcement_mode === 'hard')) {
      const cert = certMap.get(`${s.id}:${t.id}`)
      const status = certStatus(cert?.expiry_date ?? null)
      if (status === 'expired') expired++
      else if (status === 'expiring') expiring++
      else if (status === 'missing') missing++
    }
  }

  return (
    <PageShell title="Training Matrix">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Link
            href={`/homes/${homeId}/compliance`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Compliance
          </Link>
        </div>

        {/* Summary */}
        <div className="flex gap-3 flex-wrap">
          {expired > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-medium">
              {expired} expired
            </span>
          )}
          {expiring > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-medium">
              {expiring} expiring within 30 days
            </span>
          )}
          {missing > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs font-medium">
              {missing} not recorded
            </span>
          )}
          {expired === 0 && expiring === 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-medium">
              All mandatory training current
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span><span className="inline-block w-5 h-5 rounded bg-green-100 text-green-800 text-center font-medium mr-1">✓</span> Valid</span>
          <span><span className="inline-block w-5 h-5 rounded bg-amber-100 text-amber-800 text-center font-medium mr-1">!</span> Expiring (30d)</span>
          <span><span className="inline-block w-5 h-5 rounded bg-red-100 text-red-800 text-center font-medium mr-1">✗</span> Expired</span>
          <span><span className="inline-block w-5 h-5 rounded bg-muted text-muted-foreground text-center font-medium mr-1">—</span> Not recorded</span>
        </div>

        {allTopics.length === 0 || allStaff.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {allTopics.length === 0
              ? 'No training topics configured. Add topics in Settings → Training Matrix.'
              : 'No active staff found.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2.5 text-left font-medium min-w-[140px] sticky left-0 bg-muted/30 z-10">
                    Staff member
                  </th>
                  {allTopics.map(t => (
                    <th
                      key={t.id}
                      className="px-2 py-2.5 text-center font-medium max-w-[60px]"
                      title={t.name}
                    >
                      <div className="truncate max-w-[56px]">{t.code || t.name.slice(0, 6)}</div>
                      {t.enforcement_mode === 'hard' && <div className="text-red-500 font-bold">*</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {allStaff.map(s => (
                  <tr key={s.id} className="hover:bg-muted/10">
                    <td className="px-3 py-2 font-medium sticky left-0 bg-background z-10 border-r">
                      <Link
                        href={`/homes/${homeId}/staff/${s.id}?tab=training`}
                        className="hover:underline"
                      >
                        {s.first_name} {s.last_name}
                      </Link>
                    </td>
                    {allTopics.map(t => {
                      const cert = certMap.get(`${s.id}:${t.id}`)
                      const status = certStatus(cert?.expiry_date ?? null)
                      const expiryStr = cert?.expiry_date
                        ? new Date(cert.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
                        : null
                      return (
                        <td key={t.id} className="px-2 py-2 text-center">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-semibold ${STATUS_STYLE[status]}`}
                            title={expiryStr ?? status}
                          >
                            {STATUS_LABEL[status]}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">* mandatory training</p>
      </div>
    </PageShell>
  )
}
