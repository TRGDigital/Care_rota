import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { AccountantAccessClient } from './accountant-access-client'

export default async function AccountantAccessPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invitations } = await supabase
    .from('accountant_invitations')
    .select('id, name, email, firm_name, role_scope, accepted_at, revoked_at, last_login_at, created_at')
    .eq('home_id', homeId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  return (
    <PageShell title="Accountant access" description="Invite your accountant to view and download payroll data.">
      <AccountantAccessClient homeId={homeId} invitations={invitations ?? []} />
    </PageShell>
  )
}
