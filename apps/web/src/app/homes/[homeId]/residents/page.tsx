import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { UserPlus, ChevronRight } from 'lucide-react'
import { ResidentForm } from './resident-form'

export default async function ResidentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { homeId } = await params
  const { tab = 'current' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const isCurrentTab = tab !== 'past'

  const query = supabase
    .from('residents')
    .select(`
      id, first_name, last_name_initial, room_number,
      admission_date, discharge_date, notes, source,
      dependency_assessments (
        overall_band, assessment_date
      )
    `)
    .eq('home_id', homeId)
    .order('room_number', { ascending: true })

  if (isCurrentTab) {
    query.is('discharge_date', null)
  } else {
    query.not('discharge_date', 'is', null)
  }

  const { data: residents } = await query

  // Find residents with assessment > 90 days old (quarterly review prompt)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const overdueReviews = (residents ?? []).filter(r => {
    const assessments = r.dependency_assessments as { assessment_date: string }[] | null
    if (!assessments?.length) return true
    const latest = assessments.sort((a, b) => b.assessment_date.localeCompare(a.assessment_date))[0]
    return latest && new Date(latest.assessment_date) < ninetyDaysAgo
  })

  return (
    <PageShell title="Residents">
      <div className="space-y-6">
        {/* AT-12: quarterly review prompt */}
        {isCurrentTab && overdueReviews.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <span className="font-medium text-amber-800">
              {overdueReviews.length} resident{overdueReviews.length !== 1 ? 's' : ''} due for dependency review
            </span>
            <span className="text-amber-700"> — last assessment was over 90 days ago</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-md border bg-muted/30 p-1 text-sm">
            <TabLink href={`/homes/${homeId}/residents`} active={isCurrentTab}>Current</TabLink>
            <TabLink href={`/homes/${homeId}/residents?tab=past`} active={!isCurrentTab}>Past</TabLink>
          </div>
          {isCurrentTab && (
            <ResidentForm homeId={homeId} mode="add">
              <button className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90">
                <UserPlus className="h-4 w-4" />
                Add resident
              </button>
            </ResidentForm>
          )}
        </div>

        {residents && residents.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <Th>Resident</Th>
                  <Th>Room</Th>
                  <Th>Admitted</Th>
                  {!isCurrentTab && <Th>Discharged</Th>}
                  <Th>Dependency</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {residents.map(r => {
                  const assessments = r.dependency_assessments as { overall_band: string; assessment_date: string }[] | null
                  const latest = assessments?.sort((a, b) => b.assessment_date.localeCompare(a.assessment_date))[0]
                  const overdue = isCurrentTab && latest && new Date(latest.assessment_date) < ninetyDaysAgo
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <Td>
                        <span className="font-medium">{r.first_name}{r.last_name_initial ? ` ${r.last_name_initial}.` : ''}</span>
                      </Td>
                      <Td>{r.room_number ?? '—'}</Td>
                      <Td>{r.admission_date ? formatDate(r.admission_date) : '—'}</Td>
                      {!isCurrentTab && <Td>{r.discharge_date ? formatDate(r.discharge_date) : '—'}</Td>}
                      <Td>
                        {latest ? (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${bandColour(latest.overall_band)}`}>
                            {formatBand(latest.overall_band)}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">No assessment</span>
                        )}
                        {overdue && (
                          <span className="ml-2 text-xs text-amber-600">Review due</span>
                        )}
                      </Td>
                      <Td>
                        <Link
                          href={`/homes/${homeId}/residents/${r.id}`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          View <ChevronRight className="h-3 w-3" />
                        </Link>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 py-16 text-center text-sm text-muted-foreground">
            {isCurrentTab ? 'No current residents. Add a resident to get started.' : 'No past residents.'}
          </div>
        )}
      </div>
    </PageShell>
  )
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded px-3 py-1 transition-colors ${active ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </Link>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatBand(b: string) {
  return { low: 'Low', medium: 'Medium', high: 'High', one_to_one: 'One-to-one' }[b] ?? b
}

function bandColour(b: string) {
  return {
    low:        'bg-green-100 text-green-800',
    medium:     'bg-yellow-100 text-yellow-800',
    high:       'bg-orange-100 text-orange-800',
    one_to_one: 'bg-red-100 text-red-800',
  }[b] ?? 'bg-muted text-muted-foreground'
}
