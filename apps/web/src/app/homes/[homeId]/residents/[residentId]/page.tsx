import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ResidentForm } from '../resident-form'
import { DischargeButton } from './discharge-button'
import { AssessmentForm } from './assessment-form'
import { BAND_LABEL, SCORE_LABELS } from '@carerota/domain'

export default async function ResidentDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; residentId: string }>
}) {
  const { homeId, residentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: resident } = await supabase
    .from('residents')
    .select('*')
    .eq('id', residentId)
    .eq('home_id', homeId)
    .single()

  if (!resident) notFound()

  const { data: assessments } = await supabase
    .from('dependency_assessments')
    .select('*, users!dependency_assessments_assessed_by_user_id_fkey(name, email)')
    .eq('resident_id', residentId)
    .eq('home_id', homeId)
    .order('assessment_date', { ascending: false })

  const latest = assessments?.[0]

  return (
    <PageShell title={`${resident.first_name}${resident.last_name_initial ? ` ${resident.last_name_initial}.` : ''}`}>
      <div className="space-y-6 max-w-2xl">
        <Link
          href={`/homes/${homeId}/residents`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Residents
        </Link>

        {/* Resident details */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                {resident.first_name}{resident.last_name_initial ? ` ${resident.last_name_initial}.` : ''}
              </h2>
              {resident.room_number && <p className="text-sm text-muted-foreground">Room {resident.room_number}</p>}
            </div>
            <div className="flex gap-2">
              {!resident.discharge_date && (
                <>
                  <ResidentForm homeId={homeId} mode="edit" residentId={residentId} defaultValues={resident}>
                    <button className="btn-secondary text-sm">Edit</button>
                  </ResidentForm>
                  <DischargeButton homeId={homeId} residentId={residentId} />
                </>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Admitted">{resident.admission_date ? formatDate(resident.admission_date) : '—'}</Stat>
            {resident.discharge_date && <Stat label="Discharged">{formatDate(resident.discharge_date)}</Stat>}
            <Stat label="Source">
              <span className="capitalize">{resident.source === 'carerota_native' ? 'CareRota' : resident.source.replace(/_/g, ' ')}</span>
            </Stat>
            {latest && (
              <Stat label="Current dependency">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${bandColour(latest.overall_band)}`}>
                  {BAND_LABEL[latest.overall_band as keyof typeof BAND_LABEL] ?? latest.overall_band}
                </span>
              </Stat>
            )}
          </dl>

          {resident.notes && (
            <p className="text-sm text-muted-foreground border-t pt-3">{resident.notes}</p>
          )}
        </div>

        {/* New assessment */}
        {!resident.discharge_date && (
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <h3 className="font-medium text-sm">Record dependency assessment</h3>
            <AssessmentForm homeId={homeId} residentId={residentId} />
          </div>
        )}

        {/* Assessment history */}
        {assessments && assessments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Assessment history</h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <Th>Date</Th>
                    <Th>Band</Th>
                    <Th>Assessed by</Th>
                    <Th>Scores</Th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assessments.map(a => {
                    const assessor = a.users as { name?: string; email?: string } | null
                    return (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 tabular-nums">{formatDate(a.assessment_date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${bandColour(a.overall_band)}`}>
                            {BAND_LABEL[a.overall_band as keyof typeof BAND_LABEL] ?? a.overall_band}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {assessor?.name ?? assessor?.email ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).map(k => (
                              <span key={k} className="text-xs bg-muted rounded px-1.5 py-0.5">
                                {abbrev(k)}: {(a as Record<string, unknown>)[k] as number}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{children}</th>
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium mt-0.5">{children}</dd>
    </div>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function bandColour(b: string) {
  return {
    low: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800', one_to_one: 'bg-red-100 text-red-800',
  }[b] ?? 'bg-muted text-muted-foreground'
}

function abbrev(key: string) {
  return { mobility_score: 'Mob', continence_score: 'Con', cognition_score: 'Cog', behaviour_score: 'Beh', clinical_complexity_score: 'Clin' }[key] ?? key
}
