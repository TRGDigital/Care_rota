import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatSupabase } from '../types'

export const name = 'get_staff_hours'

export const description =
  'Returns hours worked by category (regular, overtime, training, absence) for one or all staff over a date range.'

export const paramSchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staff_id:  z.string().uuid().optional(),
  top_n:     z.number().int().min(1).max(20).optional(),
})

export type Params = z.infer<typeof paramSchema>

type StaffRow = {
  user_id: string
  name: string
  regular_hours:  number
  overtime_hours: number
  training_hours: number
  total_hours:    number
}

export type Result = {
  staff: StaffRow[]
  date_from: string
  date_to:   string
  _rowIds: string[]
}

// time_entries table created in Sprint 5 — cast to bypass pre-Sprint-5 type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  const db = supabase as AnyClient

  let query = db
    .from('time_entries')
    .select('id, user_id, category, actual_hours, users!inner(name)')
    .eq('home_id', homeId)
    .gte('work_date', params.date_from)
    .lte('work_date', params.date_to)

  if (params.staff_id) query = query.eq('user_id', params.staff_id)

  const { data, error } = await query
  if (error) throw new Error((error as { message: string }).message)

  type Entry = { id: string; user_id: string; category: string | null; actual_hours: number | null; users: { name?: string } | { name?: string }[] | null }
  const rows = (data ?? []) as Entry[]
  const rowIds = rows.map(r => `time_entries:${r.id}`)

  type UserEntry = { user_id: string; name: string; regular: number; overtime: number; training: number }
  const byUser = new Map<string, UserEntry>()

  for (const r of rows) {
    const users = r.users
    const nameVal = Array.isArray(users) ? (users[0]?.name ?? r.user_id) : (users?.name ?? r.user_id)
    if (!byUser.has(r.user_id)) {
      byUser.set(r.user_id, { user_id: r.user_id, name: nameVal, regular: 0, overtime: 0, training: 0 })
    }
    const entry = byUser.get(r.user_id)!
    const hours = r.actual_hours ?? 0
    if (r.category === 'overtime') entry.overtime += hours
    else if (r.category === 'training') entry.training += hours
    else entry.regular += hours
  }

  let staff: StaffRow[] = [...byUser.values()].map(e => ({
    user_id:        e.user_id,
    name:           e.name,
    regular_hours:  e.regular,
    overtime_hours: e.overtime,
    training_hours: e.training,
    total_hours:    e.regular + e.overtime + e.training,
  }))

  staff.sort((a, b) => b.total_hours - a.total_hours)
  if (params.top_n) staff = staff.slice(0, params.top_n)

  return { staff, date_from: params.date_from, date_to: params.date_to, _rowIds: rowIds }
}
