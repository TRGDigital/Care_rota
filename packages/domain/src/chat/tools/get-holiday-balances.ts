import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatSupabase } from '../types'

export const name = 'get_holiday_balances'

export const description =
  'Returns holiday entitlement, booked, and taken balances per staff member.'

export const paramSchema = z.object({
  staff_id: z.string().uuid().optional(),
  year:     z.number().int().min(2020).max(2040).optional(),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  balances: {
    user_id:         string
    name:            string
    entitlement_hrs: number
    taken_hrs:       number
    booked_hrs:      number
    remaining_hrs:   number
  }[]
  _rowIds: string[]
}

// holiday_entitlements table created in Sprint 4 — cast to bypass pre-Sprint-4 type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  const db = supabase as AnyClient
  const year = params.year ?? new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  let query = db
    .from('holiday_entitlements')
    .select('id, user_id, entitlement_hours, taken_hours, booked_hours, users!inner(name)')
    .eq('home_id', homeId)
    .gte('period_start', yearStart)
    .lte('period_start', yearEnd)

  if (params.staff_id) query = query.eq('user_id', params.staff_id)

  const { data, error } = await query
  if (error) throw new Error((error as { message: string }).message)

  type Row = { id: string; user_id: string; entitlement_hours: number | null; taken_hours: number | null; booked_hours: number | null; users: { name?: string } | { name?: string }[] | null }
  const rows = (data ?? []) as Row[]

  const balances = rows.map(r => {
    const users = r.users
    const name = Array.isArray(users) ? (users[0]?.name ?? r.user_id) : (users?.name ?? r.user_id)
    const ent    = r.entitlement_hours ?? 0
    const taken  = r.taken_hours ?? 0
    const booked = r.booked_hours ?? 0
    return {
      user_id:         r.user_id,
      name,
      entitlement_hrs: ent,
      taken_hrs:       taken,
      booked_hrs:      booked,
      remaining_hrs:   ent - taken - booked,
    }
  })

  return { balances, _rowIds: rows.map(r => `holiday_entitlements:${r.id}`) }
}
