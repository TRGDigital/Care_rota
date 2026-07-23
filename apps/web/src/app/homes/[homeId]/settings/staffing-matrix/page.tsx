import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MatrixForm } from './matrix-form'

export default async function StaffingMatrixPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: matrices } = await supabase
    .from('staffing_matrices')
    .select('*')
    .eq('home_id', homeId)
    .order('shift_block', { ascending: true })

  return (
    <PageShell title="Staffing Matrix">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <Link
            href={`/homes/${homeId}/settings`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Settings
          </Link>
          <MatrixForm homeId={homeId} mode="add">
            <button className="btn-primary text-sm">Add matrix row</button>
          </MatrixForm>
        </div>

        <p className="text-sm text-muted-foreground">
          The staffing matrix defines the minimum headcount per shift block. The cost guard uses this
          to propose rota cuts when occupancy drops, and the Staffing Justification report presents
          it to CQC inspectors.
        </p>

        {matrices && matrices.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <Th>Shift block</Th>
                  <Th>Name</Th>
                  <Th>Min carers</Th>
                  <Th>Min seniors</Th>
                  <Th>Min nurses</Th>
                  <Th>Min ancillary</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {matrices.map(m => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 capitalize font-medium">{m.shift_block}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.name}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{m.min_carers}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{m.min_senior_carers}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{m.min_nurses}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{m.min_ancillary}</td>
                    <td className="px-4 py-2.5">
                      <MatrixForm homeId={homeId} mode="edit" matrixId={m.id} defaultValues={m}>
                        <button className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                      </MatrixForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 py-16 text-center text-sm text-muted-foreground">
            No matrix rows yet. Add a row to configure minimum staffing levels.
          </div>
        )}
      </div>
    </PageShell>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{children}</th>
}
