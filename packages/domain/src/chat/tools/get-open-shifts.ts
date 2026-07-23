import { z } from 'zod'
import type { ChatSupabase } from '../types'

export const name = 'get_open_shifts'

export const description =
  'Returns unfilled (unassigned) shifts in the next N days.'

export const paramSchema = z.object({
  days_ahead: z.number().int().min(1).max(90).default(14),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  shifts: {
    id: string
    planned_start_utc: string
    planned_end_utc:   string
    state:             string
  }[]
  total: number
  _rowIds: string[]
}

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  const from = new Date().toISOString()
  const to   = new Date(Date.now() + params.days_ahead * 86_400_000).toISOString()

  const { data, error } = await supabase
    .from('shifts')
    .select('id, planned_start_utc, planned_end_utc, state')
    .eq('home_id', homeId)
    .eq('state', 'unassigned')
    .gte('planned_start_utc', from)
    .lte('planned_start_utc', to)
    .order('planned_start_utc')

  if (error) throw new Error(error.message)

  const rows = data ?? []
  return {
    shifts:  rows,
    total:   rows.length,
    _rowIds: rows.map(r => `shifts:${r.id}`),
  }
}
