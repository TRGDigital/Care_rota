import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

type RouteParams = { params: Promise<{ homeId: string; runId: string }> }

// PATCH — state transitions: in_review → approved
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { homeId, runId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { action } = await req.json() as { action: 'submit_for_review' | 'approve' | 'void' }
  const svc = createServiceClient()

  const { data: run, error } = await svc
    .from('pay_runs')
    .select('id, status, pay_period_id, home_id, tenant_id')
    .eq('id', runId)
    .eq('home_id', homeId)
    .single()

  if (error || !run) return NextResponse.json({ error: 'Pay run not found' }, { status: 404 })

  const transitions: Record<string, { from: string; to: string }> = {
    submit_for_review: { from: 'draft', to: 'in_review' },
    approve: { from: 'in_review', to: 'approved' },
    void: { from: 'draft', to: 'void' },
  }

  const transition = transitions[action]
  if (!transition) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  if (run.status !== transition.from) {
    return NextResponse.json(
      { error: `Cannot ${action} a pay run with status '${run.status}'` },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  const { error: updateErr } = await svc.from('pay_runs').update(
    action === 'approve'
      ? { status: transition.to as 'approved', approved_at: now, approved_by_user_id: user.id, updated_by_user_id: user.id }
      : action === 'submit_for_review'
      ? { status: transition.to as 'in_review', submitted_for_review_at: now, submitted_by_user_id: user.id, updated_by_user_id: user.id }
      : { status: transition.to as 'void', updated_by_user_id: user.id }
  ).eq('id', runId)
  if (updateErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  await svc.from('audit_events').insert({
    home_id: homeId,
    tenant_id: run.tenant_id,
    actor_user_id: user.id,
    action_code: `pay_run_${action}`,
    entity_type: 'pay_run',
    entity_id: runId,
    after_state_json: { status: transition.to },
  })

  return NextResponse.json({ runId, status: transition.to })
}
