import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendAccountantInvite } from '@/lib/email'
import { randomBytes, createHash } from 'crypto'

type RouteParams = { params: Promise<{ homeId: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { name, email, firmName, scope } =
    await req.json() as { name: string; email: string; firmName?: string; scope: 'home' | 'org' }

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'name and email required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: home } = await svc.from('homes').select('name, tenant_id, organisation_id').eq('id', homeId).single()
  if (!home) return NextResponse.json({ error: 'Home not found' }, { status: 404 })

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await svc.from('accountant_invitations').insert({
    tenant_id: home.tenant_id,
    home_id: homeId,
    organisation_id: home.organisation_id,
    invited_by_user_id: user.id,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    firm_name: firmName?.trim() ?? null,
    role_scope: scope,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002'
  const inviteUrl = `${appUrl}/accountant/accept-invite?token=${rawToken}`

  await sendAccountantInvite({ to: email.trim(), name: name.trim(), homeName: home.name, inviteUrl })

  await svc.from('audit_events').insert({
    home_id: homeId,
    tenant_id: home.tenant_id,
    actor_user_id: user.id,
    action_code: 'accountant_invited',
    entity_type: 'accountant_invitation',
    entity_id: tokenHash,
    after_state_json: { email: email.trim(), scope },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data } = await supabase
    .from('accountant_invitations')
    .select('id, name, email, firm_name, role_scope, accepted_at, revoked_at, created_at, last_login_at')
    .eq('home_id', homeId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}
