import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@carerota/types'

export type ChatSupabase = SupabaseClient<Database>

// ── Planner output ──────────────────────────────────────────────────────────

export type QuestionType =
  | 'aggregation'
  | 'factual_lookup'
  | 'what_if'
  | 'anomaly'
  | 'policy'

export type ToolCallPlan = {
  name: string
  params: Record<string, unknown>
}

export type PlannerOutput = {
  question_type: QuestionType
  tools: ToolCallPlan[]
  verification_strategy: 'numeric_check' | 'none'
  refused: false
} | {
  refused: true
  refusal_message: string
}

// ── Tool layer ───────────────────────────────────────────────────────────────

export type Citation = {
  text: string
  source_tool: string
  source_rows: string[]   // "<table>:<uuid>" format
  total_pence?: number | undefined
}

export type ToolResult = {
  tool_name: string
  data: unknown
  row_ids: string[]       // "<table>:<uuid>" — every row that contributed
  summary: string         // 1-line summary for the verifier context
}

// ── Verifier output ──────────────────────────────────────────────────────────

export type ChatResponse = {
  content: string
  citations: Citation[]
  tools_used: string[]
  tokens_in: number
  tokens_out: number
  latency_ms: number
  cost_pence: number
}

// ── Tool definition ───────────────────────────────────────────────────────────

export type ToolDef<TParams, TResult> = {
  name: string
  description: string
  paramSchema: import('zod').ZodType<TParams>
  run: (params: TParams, supabase: ChatSupabase, homeId: string) => Promise<TResult & { _rowIds: string[] }>
}
