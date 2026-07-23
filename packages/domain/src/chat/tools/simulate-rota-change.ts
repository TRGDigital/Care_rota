import { z } from 'zod'
import type { ChatSupabase } from '../types'

export const name = 'simulate_rota_change'

export const description =
  'Simulates the cost delta of proposed rota changes (e.g. removing a shift) without modifying any data.'

export const paramSchema = z.object({
  proposed_changes: z.array(z.object({
    action:      z.enum(['remove_shift', 'change_shift_hours']),
    shift_id:    z.string().uuid().optional(),
    date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    delta_hours: z.number().optional(),
  })).min(1).max(20),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  total_saving_pence: number
  changes: {
    action:       string
    shift_id?:    string | undefined
    saving_pence: number
    description:  string
  }[]
  note: string
  _rowIds: string[]
}

const DEFAULT_HOURLY_PENCE = 1200

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  const changes: Result['changes'] = []
  const rowIds: string[] = []
  let totalSaving = 0

  for (const change of params.proposed_changes) {
    if (change.action === 'remove_shift' && change.shift_id) {
      const { data: shift } = await supabase
        .from('shifts')
        .select('id, planned_paid_hours, planned_start_utc')
        .eq('home_id', homeId)
        .eq('id', change.shift_id)
        .maybeSingle()

      if (shift) {
        const saving = Math.round((shift.planned_paid_hours ?? 0) * DEFAULT_HOURLY_PENCE)
        totalSaving += saving
        rowIds.push(`shifts:${shift.id}`)
        changes.push({
          action:       'remove_shift',
          shift_id:     shift.id,
          saving_pence: saving,
          description:  `Remove shift on ${shift.planned_start_utc.slice(0, 10)} — saves ~£${(saving / 100).toFixed(2)}`,
        })
      }
    } else if (change.action === 'remove_shift' && change.date) {
      // Remove all unassigned shifts on a given day
      const { data: dayShifts } = await supabase
        .from('shifts')
        .select('id, planned_paid_hours, planned_start_utc')
        .eq('home_id', homeId)
        .gte('planned_start_utc', change.date)
        .lte('planned_start_utc', change.date + 'T23:59:59Z')
        .in('state', ['unassigned', 'assigned'])

      for (const shift of dayShifts ?? []) {
        const saving = Math.round((shift.planned_paid_hours ?? 0) * DEFAULT_HOURLY_PENCE)
        totalSaving += saving
        rowIds.push(`shifts:${shift.id}`)
        changes.push({
          action:       'remove_shift',
          shift_id:     shift.id,
          saving_pence: saving,
          description:  `Remove shift on ${change.date} — saves ~£${(saving / 100).toFixed(2)}`,
        })
      }
    }
  }

  return {
    total_saving_pence: totalSaving,
    changes,
    note: 'This is a simulation only — no rota changes have been made.',
    _rowIds: rowIds,
  }
}
