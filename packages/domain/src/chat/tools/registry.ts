import * as getPayrollSummary  from './get-payroll-summary'
import * as getStaffHours       from './get-staff-hours'
import * as getRotaForPeriod    from './get-rota-for-period'
import * as getOpenShifts       from './get-open-shifts'
import * as getComplianceStatus from './get-compliance-status'
import * as getOccupancyTrend   from './get-occupancy-trend'
import * as getHolidayBalances  from './get-holiday-balances'
import * as getOverrides        from './get-overrides'
import * as compareMetrics      from './compare-metrics'
import * as simulateRotaChange  from './simulate-rota-change'
import * as getAuditTrail       from './get-audit-trail'
import * as searchPolicy        from './search-policy'
import type { ChatSupabase } from '../types'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRun = (params: any, supabase: ChatSupabase, homeId: string) => Promise<{ _rowIds: string[] } & Record<string, unknown>>

type AnyTool = {
  name: string
  description: string
  paramSchema: z.ZodTypeAny
  run: AnyRun
}

export const TOOLS: AnyTool[] = [
  getPayrollSummary,
  getStaffHours,
  getRotaForPeriod,
  getOpenShifts,
  getComplianceStatus,
  getOccupancyTrend,
  getHolidayBalances,
  getOverrides,
  compareMetrics,
  simulateRotaChange,
  getAuditTrail,
  searchPolicy,
]

export const TOOL_MAP = new Map<string, AnyTool>(TOOLS.map(t => [t.name, t]))

// Anthropic tool_use format for the planner call
export const ANTHROPIC_TOOL_SPECS = TOOLS.map(t => ({
  name:         t.name,
  description:  t.description,
  input_schema: zodToJsonSchema(t.paramSchema),
}))

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const props: Record<string, unknown> = {}
    const required: string[] = []
    for (const [key, val] of Object.entries(schema.shape as Record<string, z.ZodTypeAny>)) {
      props[key] = zodFieldToJsonSchema(val)
      if (!(val instanceof z.ZodOptional) && !(val instanceof z.ZodDefault)) {
        required.push(key)
      }
    }
    return { type: 'object', properties: props, required }
  }
  return { type: 'object', properties: {} }
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): Record<string, unknown> {
  if (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
    return zodFieldToJsonSchema(field._def.innerType as z.ZodTypeAny)
  }
  if (field instanceof z.ZodString)  return { type: 'string' }
  if (field instanceof z.ZodNumber)  return { type: 'number' }
  if (field instanceof z.ZodBoolean) return { type: 'boolean' }
  if (field instanceof z.ZodEnum)    return { type: 'string', enum: (field._def as { values: string[] }).values }
  if (field instanceof z.ZodArray)   return { type: 'array', items: zodFieldToJsonSchema(field._def.type as z.ZodTypeAny) }
  if (field instanceof z.ZodObject)  return zodToJsonSchema(field)
  return {}
}
