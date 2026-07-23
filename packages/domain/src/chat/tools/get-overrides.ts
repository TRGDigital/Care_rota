import { z } from 'zod'
import type { ChatSupabase } from '../types'

export const name = 'get_overrides'

export const description =
  'Returns manager rule overrides over a date range, optionally filtered by rule code or manager.'

export const paramSchema = z.object({
  date_from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rule_filter:    z.string().optional(),
  manager_filter: z.string().uuid().optional(),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  overrides: {
    id:             string
    rule_code:      string
    reason_category: string
    overridden_at:  string
    manager_name:   string
  }[]
  total: number
  by_rule: Record<string, number>
  _rowIds: string[]
}

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  let query = supabase
    .from('rule_overrides')
    .select('id, rule_code, reason_category, overridden_at, overridden_by_user_id, users!rule_overrides_overridden_by_user_id_fkey(name)')
    .eq('home_id', homeId)
    .gte('overridden_at', params.date_from)
    .lte('overridden_at', params.date_to + 'T23:59:59Z')
    .order('overridden_at', { ascending: false })

  if (params.rule_filter)    query = query.eq('rule_code', params.rule_filter)
  if (params.manager_filter) query = query.eq('overridden_by_user_id', params.manager_filter)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []

  const byRule: Record<string, number> = {}
  const overrides = rows.map(r => {
    const users = r.users as { name?: string } | { name?: string }[] | null
    const managerName = Array.isArray(users) ? (users[0]?.name ?? 'Unknown') : (users?.name ?? 'Unknown')
    byRule[r.rule_code] = (byRule[r.rule_code] ?? 0) + 1
    return {
      id:              r.id,
      rule_code:       r.rule_code,
      reason_category: r.reason_category ?? '',
      overridden_at:   r.overridden_at,
      manager_name:    managerName,
    }
  })

  return {
    overrides,
    total:   rows.length,
    by_rule: byRule,
    _rowIds: rows.map(r => `rule_overrides:${r.id}`),
  }
}
