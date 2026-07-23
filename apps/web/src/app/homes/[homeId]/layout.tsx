import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavSidebar } from '@/components/nav/nav-sidebar'
import { TopBar } from '@/components/nav/top-bar'
import { ChatPanel } from '@/components/chat/chat-panel'

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: roleCheck } = await supabase
    .from('user_home_roles')
    .select('home_id')
    .eq('user_id', user.id)
    .eq('home_id', homeId)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle()

  if (!roleCheck) redirect('/homes')

  const { data: home } = await supabase
    .from('homes')
    .select('id, name')
    .eq('id', homeId)
    .single()

  if (!home) redirect('/homes')

  const { data: allRoles } = await supabase
    .from('user_home_roles')
    .select('home_id')
    .eq('user_id', user.id)
    .not('home_id', 'is', null)
    .is('revoked_at', null)

  const allHomeIds = [...new Set((allRoles ?? []).map(r => r.home_id).filter(Boolean))] as string[]

  const allHomes = allHomeIds.length > 1
    ? (await supabase.from('homes').select('id, name').in('id', allHomeIds).order('name')).data ?? []
    : null

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <NavSidebar
        homeId={homeId}
        homeName={home.name}
        allHomes={allHomes}
        userId={user.id}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar homeName={home.name} userEmail={user.email ?? ''} />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <ChatPanel homeId={homeId} />
    </div>
  )
}
