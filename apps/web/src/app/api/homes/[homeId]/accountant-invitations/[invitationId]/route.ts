import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendAccountantRevoked } from '@/lib/email'

type RouteParams = { params: Promise<{ homeId: string; invitationId: string }> }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { homeId, invitationId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const svc = createServiceClient()

  const { data: invite } = await svc
    .from('accountant_invitations')
    .select('id, email, name, tenant_id, user_id, revoked_at')
    .eq('id', invitationId)
    .eq('home_id', homeId)
    .single()

  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (invite.revoked_at) return NextResponse.json({ error: 'Already revoked' }, { status: 409 })

  const now = new Date().toISOString()
  await svc.from('accountant_invitations').update({
    revoked_at: now,
    revoked_by_user_id: user.id,
    updated_by_user_id: user.id,
  }).eq('id', invitationId)

  // Immediately invalidate any active session for the accountant user
  if (invite.user_id) {
    await svc.auth.admin.signOut(invite.user_id)
  }

  const { data: home } = await svc.from('homes').select('name, tenant_id').eq('id', homeId).single()

  await svc.from('audit_events').insert({
    home_id: homeId,
    tenant_id: invite.tenant_id,
    actor_user_id: user.id,
    action_code: 'accountant_revoked',
    entity_type: 'accountant_invitation',
    entity_id: invitationId,
    after_state_json: { revoked_at: now, email: invite.email },
  })

  // Email the accountant
  await sendAccountantRevoked({ to: invite.email, name: invite.name ?? 'Accountant', homeName: home?.name ?? '' })

  return NextResponse.json({ ok: true })
}
