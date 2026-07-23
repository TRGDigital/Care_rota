// Monthly override digest — runs on the 1st of each month via Supabase Cron.
// Sends an email to each home's owner(s) summarising override patterns
// from the prior calendar month, then writes an override_digest_log row.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('DIGEST_FROM_EMAIL') ?? 'noreply@carerota.com'

Deno.serve(async () => {
  const now = new Date()

  // Prior calendar month window
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1, 0, 0, 0, 0)

  const { data: homes, error: homesErr } = await supabase
    .from('homes')
    .select('id, name, organisation_id, tenant_id')

  if (homesErr) {
    return new Response(JSON.stringify({ error: homesErr.message }), { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const home of homes ?? []) {
    try {
      const result = await processHomeDigest(home, periodStart, periodEnd, now)
      if (result === 'sent') sent++
      else skipped++
    } catch (err) {
      console.error('override-digest error', { homeId: home.id, err })
      errors++
    }
  }

  return new Response(
    JSON.stringify({ sent, skipped, errors, period: { start: periodStart.toISOString(), end: periodEnd.toISOString() } }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})

async function processHomeDigest(
  home: { id: string; name: string; organisation_id: string; tenant_id: string },
  periodStart: Date,
  periodEnd: Date,
  now: Date,
): Promise<'sent' | 'skipped'> {
  // Skip if already sent for this period
  const { count: alreadySent } = await supabase
    .from('override_digest_log')
    .select('id', { count: 'exact', head: true })
    .eq('home_id', home.id)
    .gte('period_start', periodStart.toISOString())

  if ((alreadySent ?? 0) > 0) return 'skipped'

  // Fetch overrides for the period
  const { data: overrides } = await supabase
    .from('rule_overrides')
    .select('id, rule_code, overridden_at, overridden_by_user_id')
    .eq('home_id', home.id)
    .gte('overridden_at', periodStart.toISOString())
    .lt('overridden_at', periodEnd.toISOString())

  const overrideCount = overrides?.length ?? 0

  // Log the digest regardless of whether overrides exist (audit trail)
  await supabase.from('override_digest_log').insert({
    tenant_id: home.tenant_id,
    home_id: home.id,
    sent_at: now.toISOString(),
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    override_count: overrideCount,
  })

  if (overrideCount === 0) return 'skipped'

  // Find owners for this home
  const { data: ownerRoles } = await supabase
    .from('user_home_roles')
    .select('user_id, users!inner ( email, name )')
    .eq('home_id', home.id)
    .eq('role_code', 'owner')
    .is('revoked_at', null)

  type UserJoin = { email: string; name: string }
  const owners = (ownerRoles ?? []).map(r => r.users as UserJoin | null).filter(Boolean) as UserJoin[]
  if (!owners.length) return 'skipped'

  // Aggregate by rule type
  const byRule = new Map<string, number>()
  const byManager = new Map<string, number>()

  for (const ov of overrides ?? []) {
    byRule.set(ov.rule_code, (byRule.get(ov.rule_code) ?? 0) + 1)
    if (ov.overridden_by_user_id) {
      byManager.set(ov.overridden_by_user_id, (byManager.get(ov.overridden_by_user_id) ?? 0) + 1)
    }
  }

  // Top 5 managers with names
  const top5ManagerIds = [...byManager.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  const { data: managerUsers } = top5ManagerIds.length > 0
    ? await supabase.from('users').select('id, name').in('id', top5ManagerIds)
    : { data: [] }

  const managerNameMap = new Map<string, string>()
  for (const u of managerUsers ?? []) managerNameMap.set(u.id, u.name)

  // Identify repeat patterns (any rule_code with > 3 overrides)
  const repeatPatterns = [...byRule.entries()]
    .filter(([, count]) => count > 3)
    .sort((a, b) => b[1] - a[1])

  const periodLabel = periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Build email HTML
  const html = buildDigestHtml({
    homeName: home.name,
    periodLabel,
    overrideCount,
    byRule,
    top5: top5ManagerIds.map(id => ({
      name: managerNameMap.get(id) ?? 'Unknown',
      count: byManager.get(id) ?? 0,
    })),
    repeatPatterns,
  })

  // Send to each owner
  if (RESEND_API_KEY) {
    for (const owner of owners) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: owner.email,
          subject: `CareRota Override Digest — ${home.name} — ${periodLabel}`,
          html,
        }),
      })
    }
  } else {
    // Dev fallback: log the digest instead of sending
    console.log('DIGEST (no RESEND_API_KEY):', { homeId: home.id, overrideCount, owners: owners.map(o => o.email) })
  }

  return 'sent'
}

function buildDigestHtml(opts: {
  homeName: string
  periodLabel: string
  overrideCount: number
  byRule: Map<string, number>
  top5: { name: string; count: number }[]
  repeatPatterns: [string, number][]
}): string {
  const ruleRows = [...opts.byRule.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([rule, count]) => `<tr><td style="padding:4px 8px">${rule.replace(/_/g, ' ')}</td><td style="padding:4px 8px;text-align:right">${count}</td></tr>`)
    .join('')

  const managerRows = opts.top5
    .map(m => `<tr><td style="padding:4px 8px">${m.name}</td><td style="padding:4px 8px;text-align:right">${m.count}</td></tr>`)
    .join('')

  const patternItems = opts.repeatPatterns
    .map(([rule, count]) => `<li>${rule.replace(/_/g, ' ')} overridden ${count} times — consider a rota review</li>`)
    .join('')

  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-bottom:4px">Override Digest</h2>
  <p style="color:#666;margin-top:0">${opts.homeName} &mdash; ${opts.periodLabel}</p>

  <p><strong>${opts.overrideCount}</strong> manager override${opts.overrideCount !== 1 ? 's' : ''} were recorded last month.</p>

  <h3>By rule type</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="background:#f5f5f5"><th style="padding:4px 8px;text-align:left">Rule</th><th style="padding:4px 8px;text-align:right">Count</th></tr></thead>
    <tbody>${ruleRows}</tbody>
  </table>

  ${opts.top5.length > 0 ? `
  <h3>Top managers by override count</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="background:#f5f5f5"><th style="padding:4px 8px;text-align:left">Manager</th><th style="padding:4px 8px;text-align:right">Overrides</th></tr></thead>
    <tbody>${managerRows}</tbody>
  </table>` : ''}

  ${patternItems ? `
  <h3>Patterns to review</h3>
  <ul style="font-size:14px;color:#555">${patternItems}</ul>` : ''}

  <hr style="margin-top:32px;border:none;border-top:1px solid #eee">
  <p style="font-size:12px;color:#999">CareRota &bull; This digest is generated automatically on the 1st of each month.</p>
</body>
</html>`
}
