import { z } from 'zod'
import type { ChatSupabase } from '../types'
import { run as getPayrollSummary } from './get-payroll-summary'
import { run as getOccupancyTrend } from './get-occupancy-trend'

export const name = 'compare_metrics'

export const description =
  'Compares a metric (payroll_cost, occupancy, overtime) side-by-side between two time periods.'

export const paramSchema = z.object({
  metric:    z.enum(['payroll_cost', 'occupancy', 'overtime', 'agency_spend']),
  period_a:  z.object({ date_from: z.string(), date_to: z.string() }),
  period_b:  z.object({ date_from: z.string(), date_to: z.string() }),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  metric:       string
  period_a:     { label: string; value: number }
  period_b:     { label: string; value: number }
  delta:        number
  delta_pct:    number
  unit:         string
  _rowIds: string[]
}

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  const allRowIds: string[] = []

  async function getValue(period: { date_from: string; date_to: string }): Promise<number> {
    if (params.metric === 'payroll_cost') {
      const r = await getPayrollSummary({ date_from: period.date_from, date_to: period.date_to }, supabase, homeId)
      allRowIds.push(...r._rowIds)
      return r.gross_pence
    }
    if (params.metric === 'overtime') {
      const r = await getPayrollSummary({ date_from: period.date_from, date_to: period.date_to }, supabase, homeId)
      allRowIds.push(...r._rowIds)
      return r.overtime_pence
    }
    if (params.metric === 'agency_spend') {
      const r = await getPayrollSummary({ date_from: period.date_from, date_to: period.date_to }, supabase, homeId)
      allRowIds.push(...r._rowIds)
      return r.agency_pence
    }
    // occupancy — return avg pct * 100 as integer
    const r = await getOccupancyTrend({ date_from: period.date_from, date_to: period.date_to }, supabase, homeId)
    allRowIds.push(...r._rowIds)
    return r.avg_occupancy_pct
  }

  const [valA, valB] = await Promise.all([
    getValue(params.period_a),
    getValue(params.period_b),
  ])

  const delta    = valB - valA
  const deltaPct = valA !== 0 ? Math.round((delta / valA) * 100 * 10) / 10 : 0
  const unit     = params.metric === 'occupancy' ? '%' : 'pence'

  return {
    metric:    params.metric,
    period_a:  { label: `${params.period_a.date_from} – ${params.period_a.date_to}`, value: valA },
    period_b:  { label: `${params.period_b.date_from} – ${params.period_b.date_to}`, value: valB },
    delta,
    delta_pct: deltaPct,
    unit,
    _rowIds:   [...new Set(allRowIds)],
  }
}
