import { z } from 'zod'
import type { ChatSupabase } from '../types'

export const name = 'get_occupancy_trend'

export const description =
  'Returns bed occupancy by day for a given date range.'

export const paramSchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  snapshots: {
    id:           string
    snapshot_at:  string
    occupied_beds: number
    vacant_beds:   number
    total_beds:    number
  }[]
  avg_occupancy_pct: number
  _rowIds: string[]
}

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  const { data, error } = await supabase
    .from('bed_occupancy_snapshots')
    .select('id, snapshot_at, occupied_beds, vacant_beds')
    .eq('home_id', homeId)
    .gte('snapshot_at', params.date_from)
    .lte('snapshot_at', params.date_to + 'T23:59:59Z')
    .order('snapshot_at')

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const snapshots = rows.map(r => ({
    id:            r.id,
    snapshot_at:   r.snapshot_at,
    occupied_beds: r.occupied_beds,
    vacant_beds:   r.vacant_beds,
    total_beds:    r.occupied_beds + r.vacant_beds,
  }))

  const avg = snapshots.length
    ? Math.round(snapshots.reduce((s, r) => s + (r.occupied_beds / (r.total_beds || 1)), 0) / snapshots.length * 100)
    : 0

  return {
    snapshots,
    avg_occupancy_pct: avg,
    _rowIds: rows.map(r => `bed_occupancy_snapshots:${r.id}`),
  }
}
