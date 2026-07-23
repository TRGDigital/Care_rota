import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatSupabase } from '../types'

export const name = 'get_payroll_summary'

export const description =
  'Returns total gross pay, net pay, overtime pay, and agency spend for a home over a period or date range. Optionally filter by staff or role.'

export const paramSchema = z.object({
  period_id:   z.string().uuid().optional(),
  date_from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  staff_id:    z.string().uuid().optional(),
  role_filter: z.string().optional(),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  gross_pence:    number
  net_pence:      number
  overtime_pence: number
  agency_pence:   number
  payslip_count:  number
  period_label:   string
  _rowIds: string[]
}

// payslips table is created in Sprint 6 — cast to bypass pre-Sprint-6 type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  const db = supabase as AnyClient

  let query = db
    .from('payslips')
    .select('id, gross_pence, net_pence, overtime_pence, agency_pence, pay_period_start, pay_period_end')
    .eq('home_id', homeId)

  if (params.period_id) query = query.eq('pay_run_id', params.period_id)
  if (params.date_from) query = query.gte('pay_period_start', params.date_from)
  if (params.date_to)   query = query.lte('pay_period_end', params.date_to)
  if (params.staff_id)  query = query.eq('user_id', params.staff_id)

  const { data, error } = await query
  if (error) throw new Error((error as { message: string }).message)

  const rows = (data ?? []) as { id: string; gross_pence: number | null; net_pence: number | null; overtime_pence: number | null; agency_pence: number | null }[]
  const periodLabel = params.date_from && params.date_to
    ? `${params.date_from} to ${params.date_to}`
    : params.period_id ?? 'requested period'

  return {
    gross_pence:    rows.reduce((s, r) => s + (r.gross_pence ?? 0), 0),
    net_pence:      rows.reduce((s, r) => s + (r.net_pence ?? 0), 0),
    overtime_pence: rows.reduce((s, r) => s + (r.overtime_pence ?? 0), 0),
    agency_pence:   rows.reduce((s, r) => s + (r.agency_pence ?? 0), 0),
    payslip_count:  rows.length,
    period_label:   periodLabel,
    _rowIds:        rows.map(r => `payslips:${r.id}`),
  }
}
