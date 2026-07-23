import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

type RouteParams = { params: Promise<{ homeId: string; payslipId: string }> }

type OverrideAction =
  | { type: 'manual_line'; lineType: string; description: string; amountPence: number; reason: string }
  | { type: 'do_not_pay'; reason: string }
  | { type: 'recalc'; reason: string }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { homeId, payslipId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json() as OverrideAction
  const svc = createServiceClient()

  // Load payslip + run to verify state
  const { data: payslip } = await svc
    .from('payslips')
    .select('id, pay_run_id, staff_id, home_id, tenant_id, net_pay_pence')
    .eq('id', payslipId)
    .eq('home_id', homeId)
    .single()
  if (!payslip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 })

  const { data: run } = await svc
    .from('pay_runs')
    .select('status')
    .eq('id', payslip.pay_run_id)
    .single()
  if (!run || run.status === 'approved' || run.status === 'exported' || run.status === 'locked') {
    return NextResponse.json({ error: 'Pay run is frozen; cannot override' }, { status: 409 })
  }

  if (body.type === 'manual_line') {
    await svc.from('payslip_lines').insert({
      payslip_id: payslipId,
      home_id: homeId,
      tenant_id: payslip.tenant_id,
      line_type: 'overtime',
      description: body.description,
      hours: 0,
      rate_pence: 0,
      multiplier: 1,
      amount_pence: body.amountPence,
      source_shift_ids: [],
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
    })
    // Update net pay
    await svc.from('payslips').update({
      net_pay_pence: payslip.net_pay_pence + body.amountPence,
      updated_by_user_id: user.id,
    }).eq('id', payslipId)
  }

  if (body.type === 'do_not_pay') {
    await svc.from('payslips').update({
      net_pay_pence: 0,
      gross_total_pence: 0,
      updated_by_user_id: user.id,
    }).eq('id', payslipId)
  }

  // Write rule_overrides row
  await svc.from('rule_overrides').insert({
    home_id: homeId,
    tenant_id: payslip.tenant_id,
    overridden_by_user_id: user.id,
    rule_code: body.type === 'manual_line' ? 'manual_payslip_line_added' : 'payslip_recalc_override',
    blocked_action: body.type,
    justification: body.reason,
    reason_category: 'manager_discretion',
    mfa_method: 'password_reentry',
    entity_type: 'payslip',
    entity_id: payslipId,
  })

  // Audit
  await svc.from('audit_events').insert({
    home_id: homeId,
    tenant_id: payslip.tenant_id,
    actor_user_id: user.id,
    action_code: `payslip_${body.type}`,
    entity_type: 'payslip',
    entity_id: payslipId,
    after_state_json: { type: body.type, reason: body.reason },
  })

  return NextResponse.json({ ok: true })
}
