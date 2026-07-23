import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { PayCycleClient } from './pay-cycle-client'

export default async function PayrollSettingsPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: home } = await supabase
    .from('homes')
    .select('id, pay_cycle_id')
    .eq('id', homeId)
    .single()

  const { data: cycle } = home?.pay_cycle_id
    ? await supabase
        .from('pay_cycles')
        .select('*')
        .eq('id', home.pay_cycle_id)
        .single()
    : { data: null }

  return (
    <PageShell title="Pay cycle" description="Configure payroll frequency and pay day rule.">
      <PayCycleClient homeId={homeId} existingCycle={cycle} />
    </PageShell>
  )
}
