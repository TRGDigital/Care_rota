import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ReviewButton } from './review-button'

export default async function OverrideLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>
  searchParams: Promise<{ rule?: string; from?: string; to?: string; page?: string }>
}) {
  const { homeId } = await params
  const { rule, from, to, page: pageParam } = await searchParams
  const page = parseInt(pageParam ?? '1', 10)
  const pageSize = 25
  const offset = (page - 1) * pageSize

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  let query = supabase
    .from('rule_overrides')
    .select(`
      id,
      rule_code,
      entity_type,
      entity_id,
      blocked_action,
      reason_category,
      justification,
      mfa_method,
      overridden_at,
      overridden_by_user_id,
      users!rule_overrides_overridden_by_user_id_fkey ( name, email )
    `, { count: 'exact' })
    .eq('home_id', homeId)
    .order('overridden_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (rule) query = query.eq('rule_code', rule)
  if (from) query = query.gte('overridden_at', from)
  if (to)   query = query.lte('overridden_at', to + 'T23:59:59Z')

  const { data: overrides, count } = await query
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  // Date range for the review record — use filter dates if set, otherwise last 7 days
  const reviewPeriodEnd   = to   ?? new Date().toISOString().slice(0, 10)
  const reviewPeriodStart = from ?? new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const overrideIds = (overrides ?? []).map(o => o.id)

  return (
    <PageShell title="Override Log">
      <div className="space-y-4">
        <Link
          href={`/homes/${homeId}/compliance`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Compliance
        </Link>

        <OverrideFilters homeId={homeId} rule={rule} from={from} to={to} />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {count ?? 0} override{(count ?? 0) !== 1 ? 's' : ''}
          </div>
          {overrideIds.length > 0 && (
            <ReviewButton
              homeId={homeId}
              overrideIds={overrideIds}
              periodStart={reviewPeriodStart}
              periodEnd={reviewPeriodEnd}
            />
          )}
        </div>

        {overrides && overrides.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <Th>Date / time</Th>
                  <Th>Rule</Th>
                  <Th>Manager</Th>
                  <Th>Reason</Th>
                  <Th>MFA</Th>
                  <Th>Justification</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {overrides.map(o => (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <Td>
                      <span className="whitespace-nowrap tabular-nums">
                        {formatDateTime(o.overridden_at)}
                      </span>
                    </Td>
                    <Td>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {o.rule_code}
                      </code>
                    </Td>
                    <Td>
                      <span className="font-medium">
                        {Array.isArray(o.users)
                          ? (o.users[0]?.name ?? o.users[0]?.email ?? '—')
                          : ((o.users as { name?: string; email?: string } | null)?.name
                              ?? (o.users as { name?: string; email?: string } | null)?.email
                              ?? '—')}
                      </span>
                    </Td>
                    <Td>{o.reason_category}</Td>
                    <Td>
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-secondary text-secondary-foreground">
                        {o.mfa_method}
                      </span>
                    </Td>
                    <Td>
                      <span className="line-clamp-2 max-w-xs text-muted-foreground">
                        {o.justification}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 py-16 text-center text-sm text-muted-foreground">
            No overrides recorded yet.
          </div>
        )}

        {totalPages > 1 && (
          <Pagination homeId={homeId} page={page} totalPages={totalPages} rule={rule} from={from} to={to} />
        )}
      </div>
    </PageShell>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>
}

function OverrideFilters({ homeId, rule, from, to }: { homeId: string; rule?: string | undefined; from?: string | undefined; to?: string | undefined }) {
  return (
    <form method="GET" action={`/homes/${homeId}/compliance/override-log`} className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Rule code</label>
        <input
          name="rule"
          defaultValue={rule ?? ''}
          placeholder="e.g. wtr_11hr_rest"
          className="rounded-md border bg-background px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">From</label>
        <input type="date" name="from" defaultValue={from ?? ''} className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">To</label>
        <input type="date" name="to" defaultValue={to ?? ''} className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <button type="submit" className="rounded-md bg-secondary text-secondary-foreground px-4 py-1.5 text-sm font-medium hover:bg-secondary/80">
        Filter
      </button>
      {(rule || from || to) && (
        <a href={`/homes/${homeId}/compliance/override-log`} className="text-sm text-muted-foreground hover:text-foreground">
          Clear
        </a>
      )}
    </form>
  )
}

function Pagination({ homeId, page, totalPages, rule, from, to }: {
  homeId: string; page: number; totalPages: number
  rule?: string | undefined; from?: string | undefined; to?: string | undefined
}) {
  function href(p: number) {
    const q = new URLSearchParams()
    if (rule) q.set('rule', rule)
    if (from) q.set('from', from)
    if (to)   q.set('to', to)
    q.set('page', String(p))
    return `/homes/${homeId}/compliance/override-log?${q.toString()}`
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      {page > 1 && <Link href={href(page - 1)} className="hover:underline">← Previous</Link>}
      <span className="text-muted-foreground">Page {page} of {totalPages}</span>
      {page < totalPages && <Link href={href(page + 1)} className="hover:underline">Next →</Link>}
    </div>
  )
}

function formatDateTime(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
