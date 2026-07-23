import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePickerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Query home access from DB directly — not from JWT claims, which require
  // the custom_access_token hook to be enabled in the Supabase dashboard.
  const { data: roleRows } = await supabase
    .from('user_home_roles')
    .select('home_id')
    .eq('user_id', user.id)
    .not('home_id', 'is', null)
    .is('revoked_at', null)

  const homeIds = [...new Set((roleRows ?? []).map(r => r.home_id).filter(Boolean))] as string[]

  // Single-home users go straight to their dashboard
  if (homeIds.length === 1 && homeIds[0]) {
    redirect(`/homes/${homeIds[0]}/dashboards`)
  }

  const { data: homes } = homeIds.length
    ? await supabase.from('homes').select('id, name, address').in('id', homeIds).order('name')
    : { data: [] }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Select a home</h1>
          <p className="text-sm text-muted-foreground">
            You have access to {homes?.length ?? 0} home{homes?.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="space-y-3">
          {homes?.map(home => (
            <HomeTile key={home.id} id={home.id} name={home.name} address={home.address} />
          ))}

          {(!homes || homes.length === 0) && (
            <div className="text-center text-sm text-muted-foreground py-8 bg-card border rounded-lg">
              No homes found. Contact your administrator.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HomeTile({ id, name, address }: { id: string; name: string; address: string }) {
  return (
    <a
      href={`/homes/${id}/dashboards`}
      className="block bg-card border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <p className="font-medium">{name}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{address}</p>
    </a>
  )
}
