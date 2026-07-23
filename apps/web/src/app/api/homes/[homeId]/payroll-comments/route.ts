import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendCommentNotification } from '@/lib/email'

type RouteParams = { params: Promise<{ homeId: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { payRunId, payslipId, payslipLineId, parentCommentId, body } =
    await req.json() as {
      payRunId: string
      payslipId?: string
      payslipLineId?: string
      parentCommentId?: string
      body: string
    }

  if (!body?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const svc = createServiceClient()

  const { data: run } = await svc
    .from('pay_runs')
    .select('id, tenant_id, home_id')
    .eq('id', payRunId)
    .eq('home_id', homeId)
    .single()
  if (!run) return NextResponse.json({ error: 'Pay run not found' }, { status: 404 })

  // Determine if the caller is an accountant and resolve their display name
  const { data: invitation } = await svc
    .from('accountant_invitations')
    .select('name')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  const isAccountant = !!invitation
  const { data: userRow } = await svc.from('users').select('name').eq('id', user.id).single()
  const authorName = (invitation?.name ?? userRow?.name ?? user.email) as string

  const { data: comment } = await svc
    .from('payroll_comments')
    .insert({
      tenant_id:          run.tenant_id,
      home_id:            homeId,
      pay_run_id:         payRunId,
      author_user_id:     user.id,
      author_name:        authorName,
      is_accountant:      isAccountant,
      body:               body.trim(),
      payslip_id:         payslipId ?? null,
      payslip_line_id:    payslipLineId ?? null,
      parent_comment_id:  parentCommentId ?? null,
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
    })
    .select('id, body, author_name, created_at, is_accountant')
    .single()

  // Audit
  await svc.from('audit_events').insert({
    home_id: homeId,
    tenant_id: run.tenant_id,
    actor_user_id: user.id,
    action_code: 'payroll_comment_added',
    entity_type: 'pay_run',
    entity_id: payRunId,
    after_state_json: { comment_id: comment?.id, payslip_id: payslipId ?? null },
  })

  // Notify registered manager (fire-and-forget)
  notifyManager(svc, homeId, run.tenant_id, user.id, body.trim(), payRunId).catch(console.error)

  return NextResponse.json(comment, { status: 201 })
}

async function notifyManager(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  homeId: string,
  tenantId: string,
  authorUserId: string,
  body: string,
  payRunId: string
) {
  const { data: home } = await svc.from('homes').select('name').eq('id', homeId).single()
  const { data: author } = await svc.from('users').select('email, name').eq('id', authorUserId).single()

  // Find the registered manager for this home via user_home_roles
  const { data: managerRole } = await svc
    .from('user_home_roles')
    .select('user_id, users!inner(email, name)')
    .eq('home_id', homeId)
    .eq('role_code', 'registered_manager')
    .limit(1)
    .single()

  type ManagerJoin = { email: string; name: string } | null
  const manager = (managerRole?.users as ManagerJoin)
  if (!manager || manager.email === author?.email) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002'
  await sendCommentNotification({
    to: manager.email,
    recipientName: manager.name ?? 'Manager',
    authorName: author?.name ?? 'Accountant',
    homeName: home?.name ?? '',
    comment: body,
    payRunUrl: `${appUrl}/homes/${homeId}/pay-runs/${payRunId}`,
  })
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const payRunId = req.nextUrl.searchParams.get('payRunId')
  if (!payRunId) return NextResponse.json({ error: 'payRunId required' }, { status: 400 })

  const { data: comments } = await supabase
    .from('payroll_comments')
    .select('id, pay_run_id, payslip_id, payslip_line_id, parent_comment_id, body, created_at, author_user_id')
    .eq('pay_run_id', payRunId)
    .eq('home_id', homeId)
    .order('created_at')

  return NextResponse.json(comments ?? [])
}
