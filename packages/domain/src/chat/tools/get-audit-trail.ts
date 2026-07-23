import { z } from 'zod'
import type { ChatSupabase } from '../types'

export const name = 'get_audit_trail'

export const description =
  'Returns audit events for a specific entity (e.g. a shift, a staff member, a pay run).'

export const paramSchema = z.object({
  entity_type: z.string(),
  entity_id:   z.string().uuid(),
  limit:       z.number().int().min(1).max(50).default(20),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  events: {
    id:         string
    action_code: string
    actor_id:   string | null
    occurred_at: string
    summary:    string
  }[]
  total: number
  _rowIds: string[]
}

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  const { data, error } = await supabase
    .from('audit_events')
    .select('id, action_code, actor_user_id, created_at, after_state_json')
    .eq('home_id', homeId)
    .eq('entity_type', params.entity_type)
    .eq('entity_id', params.entity_id)
    .order('created_at', { ascending: false })
    .limit(params.limit)

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const events = rows.map(r => ({
    id:          r.id,
    action_code: r.action_code,
    actor_id:    r.actor_user_id,
    occurred_at: r.created_at,
    summary:     `${r.action_code}`,
  }))

  return { events, total: rows.length, _rowIds: rows.map(r => `audit_events:${r.id}`) }
}
