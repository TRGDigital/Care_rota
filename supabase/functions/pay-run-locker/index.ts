import { createClient } from 'jsr:@supabase/supabase-js@2'

// Nightly: transition approved pay runs to locked after 90 days.
Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: runs } = await supabase
    .from('pay_runs')
    .select('id, home_id, tenant_id, approved_at')
    .eq('status', 'approved')
    .lte('approved_at', ninetyDaysAgo.toISOString())

  let locked = 0
  for (const run of runs ?? []) {
    await supabase.from('pay_runs').update({
      status: 'locked',
      locked_at: new Date().toISOString(),
    }).eq('id', run.id)

    await supabase.from('audit_events').insert({
      home_id: run.home_id,
      tenant_id: run.tenant_id,
      actor_user_id: null,
      action_code: 'pay_run_auto_locked',
      entity_type: 'pay_run',
      entity_id: run.id,
      after_state_json: { status: 'locked', approved_at: run.approved_at },
    })
    locked++
  }

  return new Response(JSON.stringify({ locked }), { status: 200 })
})
