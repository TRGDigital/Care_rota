import { z } from 'zod'
import type { ChatSupabase } from '../types'

export const name = 'get_rota_for_period'

export const description =
  'Returns the published rota for a given period, optionally filtered by date.'

export const paramSchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  shifts: {
    id: string
    planned_start_utc: string
    planned_end_utc: string
    state: string
  }[]
  total_shifts: number
  _rowIds: string[]
}

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  let query = supabase
    .from('shifts')
    .select('id, planned_start_utc, planned_end_utc, state')
    .eq('home_id', homeId)
    .in('state', ['assigned', 'unassigned', 'completed'])

  if (params.date_from) query = query.gte('planned_start_utc', params.date_from)
  if (params.date_to)   query = query.lte('planned_start_utc', params.date_to + 'T23:59:59Z')

  const { data, error } = await query.order('planned_start_utc')
  if (error) throw new Error(error.message)

  const rows = data ?? []
  return {
    shifts:       rows,
    total_shifts: rows.length,
    _rowIds:      rows.map(r => `shifts:${r.id}`),
  }
}
