import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

type RouteParams = { params: Promise<{ homeId: string; runId: string }> }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { homeId, runId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const svc = createServiceClient()

  const { data: run } = await svc
    .from('pay_runs')
    .select('id, status, tenant_id')
    .eq('id', runId)
    .eq('home_id', homeId)
    .single()

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (run.status !== 'exported' && run.status !== 'approved') {
    return NextResponse.json({ error: 'Pay run must be exported or approved' }, { status: 409 })
  }

  await svc.from('pay_runs').update({
    marked_filed_at: new Date().toISOString(),
    marked_filed_by_user_id: user.id,
    updated_by_user_id: user.id,
  }).eq('id', runId)

  await svc.from('audit_events').insert({
    home_id: homeId,
    tenant_id: run.tenant_id,
    actor_user_id: user.id,
    action_code: 'pay_run_marked_filed',
    entity_type: 'pay_run',
    entity_id: runId,
    after_state_json: { marked_filed_at: new Date().toISOString() },
  })

  return NextResponse.json({ ok: true })
}
