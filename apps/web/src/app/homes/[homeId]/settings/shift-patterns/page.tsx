import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { ShiftPatternForm } from './shift-pattern-form'
import { DeletePatternButton } from './delete-button'

const TYPE_LABELS: Record<string, string> = {
  long_day_12h: 'Long day (12h)',
  short_half_6h: 'Short / half (6h)',
  sleep_in: 'Sleep-in',
  custom: 'Custom',
}

export default async function ShiftPatternsPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: patterns } = await supabase
    .from('shift_pattern_templates')
    .select('*')
    .eq('home_id', homeId)
    .order('start_time_local')

  return (
    <PageShell title="Shift patterns" description="Reusable shift templates used when building rotas.">
      <div className="max-w-2xl space-y-4 mt-6">
        {patterns && patterns.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Start</th>
                  <th className="text-left px-4 py-2 font-medium">End</th>
                  <th className="text-left px-4 py-2 font-medium">Break</th>
                  <th className="text-left px-4 py-2 font-medium">Paid hrs</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {patterns.map(p => (
                  <tr key={p.id} className="bg-card hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.start_time_local}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.end_time_local}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.break_minutes}m</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.paid_hours_decimal}h</td>
                    <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[p.length_type] ?? p.length_type}</td>
                    <td className="px-4 py-3 text-right">
                      <DeletePatternButton homeId={homeId} patternId={p.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(!patterns || patterns.length === 0) && (
          <p className="text-sm text-muted-foreground py-4">No shift patterns yet. Add one below.</p>
        )}

        <ShiftPatternForm homeId={homeId} />
      </div>
    </PageShell>
  )
}
