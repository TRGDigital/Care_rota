import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BedForm } from './bed-form'
import { BulkBedImport } from './bulk-bed-import'
import { BedCapacityInput } from './bed-capacity-input'

export default async function BedsSettingsPage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: beds }, { data: home }] = await Promise.all([
    supabase
      .from('beds')
      .select('*')
      .eq('home_id', homeId)
      .order('room_number', { ascending: true }),
    supabase
      .from('homes')
      .select('bed_capacity')
      .eq('id', homeId)
      .single(),
  ])

  const total = beds?.length ?? 0
  const active = beds?.filter(b => b.status !== 'maintenance').length ?? 0
  const occupied = beds?.filter(b => b.status === 'occupied').length ?? 0

  return (
    <PageShell title="Beds">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <Link
            href={`/homes/${homeId}/settings`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Settings
          </Link>
        </div>

        {/* Quick capacity — set the total number of beds without adding each one */}
        <BedCapacityInput homeId={homeId} value={home?.bed_capacity ?? 0} />

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total beds', value: total },
            { label: 'Active beds', value: active },
            { label: 'Occupied', value: occupied },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <BulkBedImport homeId={homeId} />
          <BedForm homeId={homeId} mode="add">
            <button className="btn-primary text-sm">Add bed</button>
          </BedForm>
        </div>

        {beds && beds.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <Th>Room</Th>
                  <Th>Capacity</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {beds.map(bed => (
                  <tr key={bed.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{bed.room_number}</td>
                    <td className="px-4 py-2.5">{bed.capacity === 1 ? 'Single' : 'Double'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColour(bed.status)}`}>
                        {formatStatus(bed.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <BedForm homeId={homeId} mode="edit" bedId={bed.id} defaultValues={bed}>
                        <button className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                      </BedForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 py-16 text-center text-sm text-muted-foreground">
            No beds configured yet. Add beds or import from CSV.
          </div>
        )}
      </div>
    </PageShell>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{children}</th>
}

function formatStatus(s: string) {
  return { vacant: 'Vacant', occupied: 'Occupied', maintenance: 'Maintenance', decommissioned: 'Decommissioned' }[s] ?? s
}

function statusColour(s: string) {
  return {
    vacant:          'bg-green-100 text-green-800',
    occupied:        'bg-blue-100 text-blue-800',
    maintenance:     'bg-yellow-100 text-yellow-800',
    decommissioned:  'bg-muted text-muted-foreground',
  }[s] ?? 'bg-muted text-muted-foreground'
}
