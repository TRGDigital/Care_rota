# Sprint 9 — Conversational Chat Layer

**Duration:** Weeks 17–18
**Spec sections:** 12 (full chat architecture), 5.1 (LLM stack)
**Depends on:** All previous sprints

## Goal

The conversational layer. By the end of this sprint, an owner or manager can ask plain-English questions about their rota and payroll and get accurate, cited answers. This is the second headline feature alongside the occupancy-aware cost guard.

## What we're building

### 1. Architecture: planner → tools → verifier

Per Section 12.2 of the spec. **Not** a vector-store-only RAG. A tool-use loop with three stages:

#### Planner

A Claude Haiku call that classifies the user's question and selects which tool(s) to invoke. Output is a JSON plan:

```json
{
  "question_type": "aggregation" | "factual_lookup" | "what_if" | "anomaly" | "policy",
  "tools": [
    { "name": "get_payroll_summary", "params": { "period": "2026-04" } }
  ],
  "verification_strategy": "numeric_check"
}
```

Haiku is fast and cheap; the planner does not need Sonnet.

#### Tool execution

A typed tool registry in `packages/domain/src/chat/tools/`. Each tool:

- Takes typed parameters (Zod-validated)
- Runs a parameterised SQL query (or a small set of them)
- Returns typed structured data
- Never returns raw rows to the LLM — always returns aggregates with row IDs for citation

The LLM **never writes free-form SQL**. It only chooses tools and parameters.

#### Verifier

A Claude Sonnet call that composes the natural-language answer. Given the user's question and the tool outputs, it:

- Writes a prose answer
- Wraps every numeric claim in citation tags pointing to source row IDs
- Returns a structured `ChatResponse` with `content` and `citations[]`

A post-check validates that every number in the prose appears verbatim in the citations data. Mismatch → retry once with the validation error in context. Two mismatches → respond with "I don't have a confident answer for that — try rephrasing".

### 2. The tool set

Per Section 12.3 of the spec. Each tool implemented as a TypeScript function backed by a parameterised SQL query:

| Tool | Purpose | Params |
|---|---|---|
| `get_payroll_summary` | Total gross/net/overtime/agency for a period or range | period_id or date_range, optional staff_filter, optional role_filter |
| `get_staff_hours` | Hours by category for one or all staff over a date range | staff_id or all, date_range, categories[] |
| `get_rota_for_period` | Published rota for a period | period_id, optional role_filter, optional date_filter |
| `get_open_shifts` | Unfilled or at-risk shifts in next N days | days_ahead, risk_filter[] |
| `get_compliance_status` | Counts of expired/expiring training, RTW, sponsorship | home_id, window_days |
| `get_occupancy_trend` | Bed occupancy by day | date_range |
| `get_holiday_balances` | Balance, booked, taken per staff | staff_id or all, with_month_breakdown |
| `get_overrides` | Manager overrides over a date range | date_range, optional rule_filter, optional manager_filter |
| `compare_metrics` | Side-by-side period comparison | metric, period_a, period_b |
| `simulate_rota_change` | What-if cost delta | proposed_changes[] |
| `get_audit_trail` | Audit events for an entity | entity_type, entity_id |
| `search_policy` | Vector search over uploaded policy documents (the only RAG-style tool) | query, top_k |

Each tool has comprehensive unit tests with fixture data.

### 3. Row-level citations

Per Section 12.4 of the spec.

Every numeric claim in the chat response carries citations. UI renders each citation as a clickable chip:

> "Last month you spent **£14,260** on overtime [📎], up **23%** from March [📎]."

Clicking the chip:

- Slides out a panel showing the underlying data
- For `get_payroll_summary`: shows the contributing payslip rows with totals
- For `get_staff_hours`: shows the shift list
- For `get_occupancy_trend`: shows the snapshot rows
- Each row in the panel is clickable to navigate to its full detail screen

Citation data is stored alongside the chat message in `chat_messages.citations_json`:

```json
{
  "claims": [
    {
      "text": "£14,260",
      "source_tool": "get_payroll_summary",
      "source_rows": ["payslip:uuid1", "payslip:uuid2", "..."],
      "total_pence": 1426000
    }
  ]
}
```

### 4. Chat UI — persistent right panel

A side panel that opens from any admin screen. Renders:

- Conversation history (last N turns)
- Composer at the bottom
- Suggested questions when empty:
  - "How much did we spend on overtime last month?"
  - "Show me staff with training expiring in 30 days"
  - "What did the manager override last week?"
  - "Compare payroll cost to last quarter"
- Each assistant response with inline citation chips
- Loading state during tool execution ("Looking up payroll for April 2026…")

Chat history persists per user per home (`chat_sessions` + `chat_messages` tables from Sprint 0 schema).

### 5. Cost and rate-limit guards

LLM API calls cost money. Implement:

- **Per-tenant rate limit** — N chat messages per hour, configurable per subscription tier
- **Token budget per session** — Sonnet calls hard-capped at X tokens per response
- **Tool call limit per question** — max 5 tool invocations per question (prevents runaway loops)
- **Cache** — common aggregations (e.g. "last month's overtime") cached for 1 hour at the tenant level

Telemetry logged to `chat_messages`:

- `tokens_in`, `tokens_out`
- `latency_ms`
- `tools_used[]`
- `cost_pence` (computed from token usage)

### 6. Policy document upload and indexing

The one place we use traditional RAG. Per Section 12.5.

Settings → Policies & Documents:

- Manager uploads HR policy, sickness procedure, holiday policy, contract templates, etc.
- Each document is parsed (PDF / DOCX / TXT supported)
- Chunked at 800 tokens with 100-token overlap
- Embedded using `voyage-3-large` or whatever CareStream uses (consistency across the suite)
- Stored in `rag_chunks` with `tenant_id`, source filename, chunk text, embedding vector

The `search_policy` tool runs cosine similarity against `rag_chunks` filtered by the home's tenant_id. Returns top-3 chunks with their source filenames.

The verifier composes an answer that quotes minimally (under 15 words per quote) and links to the source document.

### 7. The 8 canonical questions — automated regression tests

Per the Definition of Done in Section 17.2 of the spec, the chat must correctly answer 8 canonical questions on pilot data. Embed these as automated tests using a frozen test dataset:

1. "How much did we spend on overtime last month?"
2. "Show me the top 5 staff by overtime hours over the last quarter."
3. "What would we save if we removed one carer from the Tuesday night shift?"
4. "Has anyone had more sick days than the home average this year?"
5. "Which staff have training expiring in the next 60 days?"
6. "Is anyone on a sponsored visa falling below their required weekly hours this period?"
7. "Compare payroll cost per occupied bed for the last 6 months."
8. "How many manager overrides were used last month and what for?"

Each test:

- Uses a frozen fixture dataset with known correct answers
- Calls the chat endpoint with the question
- Asserts that the answer contains the correct numbers
- Asserts that the citations point to the correct rows

Run on every CI build; chat changes that regress any of these block deployment.

### 8. What the chat will NOT do

Per Section 12.5 of the spec. Hard constraints in the planner:

- It will not make rota changes directly — it can simulate (`simulate_rota_change`) and propose, but writing requires a manager-authenticated UI action
- It will not approve payroll, holiday requests, or any monetary action
- It will not answer medical or care questions about residents — refer to CareStream
- It will not authorise overrides — it can show the override log but not perform overrides
- It will not generate HR or legal advice — it will quote the home's own policy or suggest the manager consult HR

Refusal responses are templated:

> "I can't approve pay runs from chat — that has to be a deliberate action in the Payroll screen. Want me to take you there?"

### 9. Accessibility

- Keyboard-navigable composer and citation chips
- Screen reader labels on every interactive element
- Citation chips announce "Source: 12 payslips, click to view" not just "📎"
- Chat panel can be opened/closed with `Cmd+K` / `Ctrl+K`

## Acceptance tests

1. Ask "How much did we spend on overtime last month?" — answer contains the correct gross overtime total in £ with a citation chip; clicking the chip shows the contributing payslip rows.
2. Ask "Show me the top 5 staff by overtime hours over the last quarter" — answer lists 5 staff with their hours; each staff member is a citation linking to their record.
3. Ask "Which staff have training expiring in the next 60 days?" — answer lists the staff and topics; clicking through opens the staff record.
4. Ask "How many manager overrides were used last month?" — answer cites the `get_overrides` tool output.
5. Ask "What's the weather like?" — answer is a polite refusal explaining the chat's scope.
6. Ask "Approve the May pay run for me" — answer is a refusal with a deep-link to the Payroll screen.
7. Ask a question requiring `simulate_rota_change` — system runs the simulation and returns the cost delta; no actual rota change is made.
8. Upload a sickness policy PDF; ask "What's our procedure for reporting sickness?" — answer cites a chunk from the uploaded document with the filename visible.
9. Citation post-check fires: if a number in the prose doesn't appear in citations data, the system retries once; on second failure, returns the safe fallback message.
10. Rate limit: send 100 questions in 5 minutes; after the configured limit the system returns "you've hit your hourly chat limit, try again in X minutes".
11. Run all 8 canonical questions against the frozen test dataset; each produces the expected answer to the cent.
12. Open the chat panel with `Cmd+K`; navigate the citation chips with Tab; activate one with Enter.

## Out of scope

- Multi-language support (v2)
- Voice input (v2)
- Proactive notifications from the assistant (v2 — "I noticed your overtime is up 30%, want to dig in?")
- Cross-home chat for owners (v2 — v1 chat is scoped to one home at a time)
- File attachments in chat (v2)

## Definition of done

- Planner → tools → verifier loop works end-to-end with Claude Sonnet
- All 12 tools implemented with unit tests and integration tests
- Row-level citations work for every tool
- Policy document upload, chunking, and `search_policy` tool work
- Rate limits and token budget enforced
- All 12 acceptance tests pass
- All 8 canonical questions answer correctly on the frozen test dataset
- Sprint demo: the owner asks 5 questions across overtime, training expiry, sponsorship hours, a what-if simulation, and a policy lookup — each answer is accurate, cited, and arrives in under 6 seconds
