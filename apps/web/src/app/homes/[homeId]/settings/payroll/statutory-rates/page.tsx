import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'

const AGE_BAND_LABELS: Record<string, string> = {
  nlw_21_plus:     'NLW (21+)',
  nmw_18_20:       'NMW (18–20)',
  nmw_16_17:       'NMW (16–17)',
  nmw_apprentice:  'NMW (Apprentice)',
}

export default async function StatutoryRatesPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId: _homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rates } = await supabase
    .from('reference_wage_rates')
    .select('*')
    .order('effective_from', { ascending: false })

  return (
    <PageShell title="Statutory rates" description="NMW/NLW floors by age band. Super admin can add new rates when announced.">
      <div className="max-w-2xl mt-6">
        {!rates?.length ? (
          <p className="text-sm text-muted-foreground">No rates configured.</p>
        ) : (
          <div className="bg-card border rounded-lg divide-y">
            {rates.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{AGE_BAND_LABELS[r.age_band] ?? r.age_band}</div>
                  <div className="text-xs text-muted-foreground">
                    From {r.effective_from}
                    {r.effective_to ? ` to ${r.effective_to}` : ' (current)'}
                  </div>
                </div>
                <div className="text-sm font-mono">
                  £{(r.rate_pence / 100).toFixed(2)}/hr
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
