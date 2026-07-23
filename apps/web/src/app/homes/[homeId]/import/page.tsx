import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { ImportWizard } from './import-wizard'

export default async function ImportPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <PageShell title="Import from payroll" description="Set up staff, roles, contracts, pay rates, fixed patterns and the standard week from your existing payroll spreadsheet.">
      <div className="mt-6">
        <ImportWizard homeId={homeId} />
      </div>
    </PageShell>
  )
}
