import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export type SuggestionChange = { type: 'reassign'; shift_id: string; to_staff_id: string }

export type AiSuggestion = {
  title: string
  detail: string
  category: 'reduce_overtime' | 'utilise_pm' | 'coverage' | 'fairness' | 'other'
  estimated_saving_pence: number
  affected: string[]
  change?: SuggestionChange
}

export type RotaSnapshot = {
  weeks: number
  staff: Array<{
    name: string
    role: string
    contracted_period_hours: number
    rotad_hours: number
    overtime_hours: number
    cost_pence: number
    overtime_rate_pence: number
    am_shifts: number
    pm_shifts: number
    am_only_days: number
  }>
  // Shifts held by over-contract staff — candidates to move to someone under contract. Carry the
  // real shift id so a suggestion can be applied in one click.
  moveable_shifts: Array<{ id: string; staff: string; staff_id: string; date: string; slot: string; hours: number }>
  under_contract: Array<{ staff_id: string; name: string; room_hours: number }>
  totals: {
    rotad_hours: number
    overtime_hours: number
    overtime_cost_pence: number
    total_cost_pence: number
    unfilled_shifts: number
    am_shifts: number
    pm_shifts: number
  }
  unfilled: Array<{ role: string; date: string; count: number }>
}

export type RecommendResult =
  | { success: true; suggestions: AiSuggestion[]; snapshot: RotaSnapshot }
  | { success: false; error: string }

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Deterministic analysis of a rota period: per-staff contracted vs rota'd hours, overtime and cost,
 * AM/PM usage, and unfilled shifts. The figures are computed here (never by the model) so the AI
 * suggestions are grounded in real numbers.
 */
export async function analyseRota(
  supabase: AnyClient,
  homeId: string,
  periodId: string
): Promise<RotaSnapshot | { error: string }> {
  const { data: period } = await supabase
    .from('rota_periods')
    .select('period_start_date, period_end_date')
    .eq('id', periodId).eq('home_id', homeId).single()
  if (!period) return { error: 'Period not found' }

  // End date is inclusive, so add a day before dividing into whole weeks.
  const weeksWhole = Math.max(1, Math.round(
    ((new Date(period.period_end_date).getTime() - new Date(period.period_start_date).getTime()) / (24 * 3_600_000) + 1) / 7
  ))

  const { data: slots } = await supabase
    .from('shift_slots')
    .select('id, date, role_code, shift_pattern_templates(start_time_local, paid_hours_decimal)')
    .eq('rota_period_id', periodId)
  if (!slots?.length) return { error: 'This week has no shifts to analyse.' }

  const slotIds = slots.map((s: { id: string }) => s.id)
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, shift_slot_id, staff_id, state, planned_start_utc, planned_paid_hours')
    .in('shift_slot_id', slotIds)
    .not('state', 'eq', 'cancelled')

  const assignedIds = [...new Set((shifts ?? []).filter((s: { staff_id: string | null }) => s.staff_id).map((s: { staff_id: string }) => s.staff_id))]
  const { data: staffRows } = assignedIds.length
    ? await supabase.from('staff').select('id, first_name, last_name, role_code').in('id', assignedIds)
    : { data: [] }
  const nameOf = new Map((staffRows ?? []).map((s: { id: string; first_name: string; last_name: string }) => [s.id, `${s.first_name} ${s.last_name}`]))
  const roleOf = new Map((staffRows ?? []).map((s: { id: string; role_code: string | null }) => [s.id, s.role_code ?? '']))

  const [{ data: contracts }, { data: rates }] = assignedIds.length
    ? await Promise.all([
        supabase.from('staff_contracts').select('staff_id, contracted_hours_per_week, effective_from').in('staff_id', assignedIds).order('effective_from', { ascending: false }),
        supabase.from('staff_pay_rates').select('staff_id, rate_weekday_pence, rate_overtime_pence, effective_from').in('staff_id', assignedIds).order('effective_from', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }]
  const contractHrs = new Map<string, number>()
  for (const c of contracts ?? []) if (!contractHrs.has(c.staff_id)) contractHrs.set(c.staff_id, Number(c.contracted_hours_per_week))
  const rateOf = new Map<string, { wd: number; ot: number }>()
  for (const rt of rates ?? []) if (!rateOf.has(rt.staff_id)) rateOf.set(rt.staff_id, { wd: Number(rt.rate_weekday_pence), ot: Number(rt.rate_overtime_pence) })

  const slotById = new Map(slots.map((s: { id: string }) => [s.id, s]))

  // Per-staff accumulation
  type Acc = { hours: number; am: number; pm: number; amDates: Set<string>; pmDates: Set<string> }
  const acc = new Map<string, Acc>()
  const unfilledMap = new Map<string, number>() // `${role}|${date}` → count
  const shiftRecords: Array<{ id: string; staff_id: string; date: string; slot: string; hours: number; isNight: boolean }> = []

  for (const sh of shifts ?? []) {
    const slot = slotById.get(sh.shift_slot_id) as { date: string; role_code: string } | undefined
    if (!slot) continue
    if (!sh.staff_id || sh.state === 'unassigned') {
      const key = `${slot.role_code}|${slot.date}`
      unfilledMap.set(key, (unfilledMap.get(key) ?? 0) + 1)
      continue
    }
    const paid = Number(sh.planned_paid_hours)
    const startHour = new Date(sh.planned_start_utc).getUTCHours()
    const isNight = startHour >= 18 || startHour < 6
    const halfDay = !isNight && paid > 0 && paid <= 7
    const slotLabel = isNight ? 'Night' : halfDay ? (startHour < 12 ? 'AM' : 'PM') : 'Day'
    shiftRecords.push({ id: sh.id, staff_id: sh.staff_id, date: slot.date, slot: slotLabel, hours: paid, isNight })
    let a = acc.get(sh.staff_id)
    if (!a) { a = { hours: 0, am: 0, pm: 0, amDates: new Set(), pmDates: new Set() }; acc.set(sh.staff_id, a) }
    a.hours += paid
    if (halfDay && startHour < 12) { a.am++; a.amDates.add(slot.date) }
    if (halfDay && startHour >= 12) { a.pm++; a.pmDates.add(slot.date) }
  }

  const staff: RotaSnapshot['staff'] = []
  const overStaff = new Set<string>()
  const under_contract: RotaSnapshot['under_contract'] = []
  let totRotad = 0, totOtHours = 0, totOtCost = 0, totCost = 0, totAm = 0, totPm = 0
  for (const [sid, a] of acc) {
    const contractedWeek = contractHrs.get(sid) ?? 0
    const contractedPeriod = r1(contractedWeek * weeksWhole)
    const hours = r1(a.hours)
    const otHours = r1(Math.max(0, hours - contractedPeriod))
    const regularHours = Math.max(0, hours - otHours)
    const rate = rateOf.get(sid)
    const wd = rate?.wd ?? 0
    const ot = rate?.ot ?? wd
    const cost = Math.round(regularHours * wd + otHours * ot)
    const amOnlyDays = [...a.amDates].filter(d => !a.pmDates.has(d)).length
    staff.push({
      name: nameOf.get(sid) ?? sid,
      role: roleOf.get(sid) ?? '',
      contracted_period_hours: contractedPeriod,
      rotad_hours: hours,
      overtime_hours: otHours,
      cost_pence: cost,
      overtime_rate_pence: ot,
      am_shifts: a.am,
      pm_shifts: a.pm,
      am_only_days: amOnlyDays,
    })
    if (otHours > 0) overStaff.add(sid)
    const room = r1(contractedPeriod - hours)
    if (room >= 1) under_contract.push({ staff_id: sid, name: nameOf.get(sid) ?? sid, room_hours: room })
    totRotad += hours; totOtHours += otHours; totOtCost += otHours * ot; totCost += cost; totAm += a.am; totPm += a.pm
  }
  staff.sort((x, y) => y.overtime_hours - x.overtime_hours)
  under_contract.sort((x, y) => y.room_hours - x.room_hours)

  // Moveable = day shifts held by over-contract staff (capped) — these are the ones that can be
  // reassigned to someone with room to cut overtime.
  const moveable_shifts = shiftRecords
    .filter(rec => !rec.isNight && overStaff.has(rec.staff_id))
    .slice(0, 40)
    .map(rec => ({ id: rec.id, staff: nameOf.get(rec.staff_id) ?? rec.staff_id, staff_id: rec.staff_id, date: rec.date, slot: rec.slot, hours: rec.hours }))

  const unfilled = [...unfilledMap.entries()].map(([k, count]) => {
    const [role, date] = k.split('|') as [string, string]
    return { role, date, count }
  }).sort((x, y) => x.date.localeCompare(y.date))

  return {
    weeks: weeksWhole,
    staff,
    moveable_shifts,
    under_contract,
    totals: {
      rotad_hours: r1(totRotad),
      overtime_hours: r1(totOtHours),
      overtime_cost_pence: Math.round(totOtCost),
      total_cost_pence: Math.round(totCost),
      unfilled_shifts: [...unfilledMap.values()].reduce((n, v) => n + v, 0),
      am_shifts: totAm,
      pm_shifts: totPm,
    },
    unfilled,
  }
}

const SYSTEM_PROMPT = `You are a UK care-home workforce planner reviewing a published/draft rota to cut avoidable overtime spend and use shift patterns efficiently. You are given a factual snapshot of one rota period with all hours and costs already calculated for you.

Your job: produce concrete, specific, actionable recommendations. Focus on:
- Reducing overtime cost: staff rostered beyond their contracted hours cost the overtime rate. Suggest moving hours from over-contract staff to those still under contract.
- Using the afternoon (PM) shift: mornings are busier, so the day is split into a Morning and an Afternoon block. A carer working mornings only (am_only_days > 0) has the afternoon free; a carer pushed into overtime could give their afternoon block to someone under contract.
- Filling gaps: unfilled shifts need cover; prefer under-contract staff over new overtime.

Hard rules you must never suggest breaking: 11 hours rest between shifts; 48h average weekly working time; required training must be in date; staff must not exceed a reasonable overtime ceiling; respect day/night preference. If a move would need one of these checked, say so.

Making a suggestion applyable:
- The snapshot lists "moveable_shifts" (shifts held by over-contract staff, each with an id) and "under_contract" staff (each with a staff_id and how many hours of room they have).
- When a suggestion is to move ONE specific moveable shift to ONE specific under-contract person, attach a "change": {"type":"reassign","shift_id":<a moveable_shifts id>,"to_staff_id":<an under_contract staff_id>}. Use ids exactly as given. Only attach a change you are confident respects the rules; the app re-checks eligibility before applying. Omit "change" for advisory suggestions that aren't a single clean reassignment.

Rules for your output:
- Use ONLY the numbers/ids in the snapshot. Never invent figures or ids. estimated_saving_pence must be derived from the provided overtime hours and rates.
- Name specific staff. Be concrete ("Move X's Thursday afternoon block to Y, who is Nh under contract").
- Rank by biggest saving first. 3 to 6 suggestions. If overtime is already near zero, say so honestly and suggest fewer.
- Return your answer by calling the return_suggestions tool. Do not write any prose outside the tool call.`

const SUGGESTIONS_TOOL = {
  name: 'return_suggestions',
  description: 'Return the ranked rota recommendations.',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            category: { type: 'string', enum: ['reduce_overtime', 'utilise_pm', 'coverage', 'fairness', 'other'] },
            estimated_saving_pence: { type: 'number' },
            affected: { type: 'array', items: { type: 'string' } },
            change: {
              type: 'object',
              description: 'Optional: a single applyable reassignment.',
              properties: {
                type: { type: 'string', enum: ['reassign'] },
                shift_id: { type: 'string' },
                to_staff_id: { type: 'string' },
              },
              required: ['type', 'shift_id', 'to_staff_id'],
            },
          },
          required: ['title', 'detail', 'category', 'estimated_saving_pence', 'affected'],
        },
      },
    },
    required: ['suggestions'],
  },
}

/**
 * Analyse the rota then ask Claude for grounded, read-only recommendations to cut overtime and use
 * the PM shift better. All numbers come from analyseRota; the model only spots patterns and phrases
 * the advice.
 */
export async function recommendRotaChanges(
  supabase: AnyClient,
  anthropic: Anthropic,
  homeId: string,
  periodId: string
): Promise<RecommendResult> {
  const snapshot = await analyseRota(supabase, homeId, periodId)
  if ('error' in snapshot) return { success: false, error: snapshot.error }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    tools: [SUGGESTIONS_TOOL],
    tool_choice: { type: 'tool', name: 'return_suggestions' },
    messages: [{
      role: 'user',
      content: `Here is the rota snapshot for a ${snapshot.weeks}-week period. Total overtime is ${snapshot.totals.overtime_hours}h costing £${(snapshot.totals.overtime_cost_pence / 100).toFixed(2)}. Recommend how to reduce it and use the PM shifts.\n\n${JSON.stringify(snapshot)}`,
    }],
  })

  // The model is forced to call the tool, so its structured input is already valid JSON.
  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  const raw = (toolUse?.input as { suggestions?: unknown[] } | undefined)?.suggestions
  if (!Array.isArray(raw)) return { success: false, error: 'The AI did not return any suggestions. Please try again.' }

  // Only keep a change whose ids actually exist in the snapshot, so a hallucinated id can never
  // reach the apply step.
  const moveableIds = new Set(snapshot.moveable_shifts.map(m => m.id))
  const underIds = new Set(snapshot.under_contract.map(u => u.staff_id))
  const suggestions: AiSuggestion[] = raw
    .filter((s: unknown): s is AiSuggestion => !!s && typeof (s as AiSuggestion).title === 'string')
    .map((s: AiSuggestion) => {
      const c = s.change
      const validChange = c && c.type === 'reassign' && moveableIds.has(c.shift_id) && underIds.has(c.to_staff_id)
        ? { type: 'reassign' as const, shift_id: c.shift_id, to_staff_id: c.to_staff_id }
        : undefined
      return {
        title: String(s.title),
        detail: String(s.detail ?? ''),
        category: (['reduce_overtime', 'utilise_pm', 'coverage', 'fairness', 'other'].includes(s.category) ? s.category : 'other') as AiSuggestion['category'],
        estimated_saving_pence: Math.max(0, Math.round(Number(s.estimated_saving_pence) || 0)),
        affected: Array.isArray(s.affected) ? s.affected.map(String).slice(0, 8) : [],
        ...(validChange ? { change: validChange } : {}),
      }
    })
    .slice(0, 8)

  return { success: true, suggestions, snapshot }
}
