import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { NewStaffForm } from './new-staff-form'

export default async function NewStaffPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: roles } = await supabase
    .from('staff_roles')
    .select('id, code, name')
    .eq('home_id', homeId)
    .order('name')

  const { data: patterns } = await supabase
    .from('shift_pattern_templates')
    .select('id, name')
    .eq('home_id', homeId)
    .order('name')

  return (
    <PageShell title="Add staff member" description="Create a new staff profile and initial contract.">
      <NewStaffForm homeId={homeId} roles={roles ?? []} patterns={patterns ?? []} />
    </PageShell>
  )
}
