import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { PremiumPayClient } from './premium-pay-client'

export default async function PremiumPayPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: entries } = await supabase
    .from('premium_pay_calendar')
    .select('id, calendar_date, name, multiplier, source')
    .eq('home_id', homeId)
    .order('calendar_date')

  return (
    <PageShell title="Premium pay calendar" description="Dates that attract enhanced pay rates (bank holidays, Christmas, etc.).">
      <PremiumPayClient homeId={homeId} initialEntries={entries ?? []} />
    </PageShell>
  )
}
