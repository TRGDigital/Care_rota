import Anthropic from '@anthropic-ai/sdk'
import type { ChatSupabase, ChatResponse, ToolResult } from './types'
import { plan } from './planner'
import { verify } from './verifier'
import { TOOL_MAP } from './tools/registry'

const MAX_TOOLS_PER_QUESTION = 5

export type ChatServiceOptions = {
  supabase:  ChatSupabase
  homeId:    string
  sessionId: string
  userId:    string
  anthropic: Anthropic
}

export async function chat(
  question: string,
  opts:     ChatServiceOptions,
): Promise<ChatResponse & { latency_ms: number }> {
  const t0 = Date.now()

  // 1. Plan
  const planOutput = await plan(question, opts.anthropic)

  if (planOutput.refused) {
    const now = Date.now()
    await persistMessage(opts, 'assistant', planOutput.refusal_message, {
      tools_used: [], citations: [], tokens_in: 0, tokens_out: 0, cost_pence: 0,
      latency_ms: now - t0,
    })
    return {
      content:    planOutput.refusal_message,
      citations:  [],
      tools_used: [],
      tokens_in:  0,
      tokens_out: 0,
      latency_ms: now - t0,
      cost_pence: 0,
    }
  }

  // 2. Execute tools (cap at MAX_TOOLS_PER_QUESTION)
  const toolResults: ToolResult[] = []
  const toolsCapped = planOutput.tools.slice(0, MAX_TOOLS_PER_QUESTION)

  for (const call of toolsCapped) {
    const toolDef = TOOL_MAP.get(call.name)
    if (!toolDef) continue

    const parsed = toolDef.paramSchema.safeParse(call.params)
    if (!parsed.success) continue

    try {
      const result = await toolDef.run(parsed.data, opts.supabase, opts.homeId)
      const { _rowIds, ...data } = result
      toolResults.push({
        tool_name: call.name,
        data,
        row_ids:  _rowIds,
        summary:  buildSummary(call.name, data),
      })
    } catch {
      // Tool errors are non-fatal; the verifier will note missing data
    }
  }

  // 3. Verify (compose answer with citations)
  let verified = await verify({ question, toolResults, anthropic: opts.anthropic })

  // Post-check: retry once if uncited numbers detected
  if (planOutput.verification_strategy === 'numeric_check') {
    const numbers = [...verified.content.matchAll(/£[\d,]+(?:\.\d{2})?/g)].map(m => m[0])
    const citedSet = new Set(verified.citations.map(c => c.text))
    if (numbers.some(n => !citedSet.has(n))) {
      const retry = await verify({ question, toolResults, anthropic: opts.anthropic })
      const retryNumbers = [...retry.content.matchAll(/£[\d,]+(?:\.\d{2})?/g)].map(m => m[0])
      const allCited = retryNumbers.every(n => new Set(retry.citations.map(c => c.text)).has(n))
      if (allCited) {
        verified = retry
      } else {
        verified = {
          ...verified,
          content: "I don't have a confident answer for that — try rephrasing your question.",
          citations: [],
        }
      }
    }
  }

  const latencyMs = Date.now() - t0

  // 4. Persist
  await persistMessage(opts, 'assistant', verified.content, {
    tools_used: toolsCapped.map(t => t.name),
    citations:  verified.citations,
    tokens_in:  verified.tokens_in,
    tokens_out: verified.tokens_out,
    cost_pence: verified.cost_pence,
    latency_ms: latencyMs,
  })

  return {
    content:    verified.content,
    citations:  verified.citations,
    tools_used: toolsCapped.map(t => t.name),
    tokens_in:  verified.tokens_in,
    tokens_out: verified.tokens_out,
    cost_pence: verified.cost_pence,
    latency_ms: latencyMs,
  }
}

async function persistMessage(
  opts: ChatServiceOptions,
  role: 'user' | 'assistant',
  content: string,
  meta: {
    tools_used: string[]
    citations:  unknown[]
    tokens_in:  number
    tokens_out: number
    cost_pence: number
    latency_ms: number
  },
) {
  await opts.supabase.from('chat_messages').insert({
    tenant_id:         opts.homeId,
    home_id:           opts.homeId,
    session_id:        opts.sessionId,
    role,
    content,
    tools_used:        meta.tools_used,
    citations_json:    meta.citations.length ? (meta.citations as unknown as import('@carerota/types/src/database.types').Json) : null,
    tokens_in:         meta.tokens_in  || null,
    tokens_out:        meta.tokens_out || null,
    cost_pence:        meta.cost_pence || null,
    latency_ms:        meta.latency_ms || null,
    created_by_user_id: opts.userId,
  })
}

function buildSummary(toolName: string, data: Record<string, unknown>): string {
  switch (toolName) {
    case 'get_payroll_summary':
      return `Gross: ${data['gross_pence']}, overtime: ${data['overtime_pence']} pence for ${data['period_label']}`
    case 'get_staff_hours':
      return `${(data['staff'] as unknown[]).length} staff records returned`
    case 'get_overrides':
      return `${data['total']} overrides found`
    case 'get_compliance_status':
      return `${data['training_expired']} expired, ${data['training_expiring']} expiring training records`
    case 'get_occupancy_trend':
      return `${(data['snapshots'] as unknown[]).length} snapshots, avg ${data['avg_occupancy_pct']}% occupancy`
    case 'simulate_rota_change':
      return `Simulation: total saving ${data['total_saving_pence']} pence`
    default:
      return `${toolName} returned data`
  }
}
