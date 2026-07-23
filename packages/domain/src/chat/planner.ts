import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_TOOL_SPECS } from './tools/registry'
import type { PlannerOutput, ToolCallPlan } from './types'

const REFUSAL_TOPICS = [
  'medical', 'clinical', 'diagnosis', 'resident care', 'care plan',
  'legal advice', 'hr advice', 'approve pay', 'approve payroll',
  'approve holiday', 'authorise override', 'make rota change',
  'weather', 'news', 'sports',
]

const SYSTEM_PROMPT = `You are the planner for CareRota's chat assistant.
Your job is to classify the user's question and select the correct tools to answer it.

You must respond with a valid JSON object matching this schema:
{
  "question_type": "aggregation" | "factual_lookup" | "what_if" | "anomaly" | "policy",
  "tools": [{ "name": "<tool_name>", "params": { ... } }],
  "verification_strategy": "numeric_check" | "none",
  "refused": false
}

OR, if the question is out of scope:
{
  "refused": true,
  "refusal_message": "<polite explanation>"
}

Out-of-scope questions include: medical/clinical questions, legal/HR advice,
approving payroll/holiday/overrides from chat, making actual rota changes,
and anything unrelated to CareRota data (weather, news, etc.).

Available tools: ${ANTHROPIC_TOOL_SPECS.map(t => t.name).join(', ')}

Use at most 5 tools per question. If the answer can be computed from one tool, use one.
Today's date for relative date calculations: ${new Date().toISOString().slice(0, 10)}.`

export async function plan(
  question: string,
  anthropic: Anthropic,
): Promise<PlannerOutput> {
  // Quick refusal check before calling the API
  const lower = question.toLowerCase()
  for (const topic of REFUSAL_TOPICS) {
    if (lower.includes(topic)) {
      return {
        refused: true,
        refusal_message: buildRefusalMessage(topic, question),
      }
    }
  }

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: question }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? '{}'

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>

    if (parsed['refused'] === true) {
      return { refused: true, refusal_message: String(parsed['refusal_message'] ?? 'Out of scope.') }
    }

    const tools = (Array.isArray(parsed['tools']) ? parsed['tools'] : []) as ToolCallPlan[]
    const validTools = tools.filter(t => typeof t.name === 'string' && typeof t.params === 'object').slice(0, 5)

    return {
      refused: false,
      question_type: (parsed['question_type'] as PlannerOutput extends { refused: false } ? PlannerOutput['question_type'] : never) ?? 'factual_lookup',
      tools: validTools,
      verification_strategy: parsed['verification_strategy'] === 'none' ? 'none' : 'numeric_check',
    }
  } catch {
    // Malformed JSON — treat as unable to plan
    return {
      refused: false,
      question_type: 'factual_lookup',
      tools: [],
      verification_strategy: 'none',
    }
  }
}

function buildRefusalMessage(topic: string, _question: string): string {
  if (topic.includes('approve pay') || topic.includes('approve payroll')) {
    return "I can't approve pay runs from chat — that has to be a deliberate action in the Payroll screen. Want me to show you the payroll summary instead?"
  }
  if (topic.includes('approve holiday')) {
    return "I can't approve holiday requests from chat — that requires a manager action in the Rota screen."
  }
  if (topic.includes('authorise override')) {
    return "I can't perform overrides from chat. I can show you the override log if that would help."
  }
  if (topic.includes('make rota change')) {
    return "I can't make rota changes directly, but I can simulate a change and show you the cost delta. Want me to do that?"
  }
  if (topic.includes('medical') || topic.includes('clinical') || topic.includes('care plan')) {
    return "I can't answer medical or care questions — please refer to CareStream for resident care information."
  }
  return "That's outside what I can help with in CareRota. I can answer questions about rotas, payroll, staff hours, compliance, and occupancy."
}
