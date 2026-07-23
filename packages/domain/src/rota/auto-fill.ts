import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export type AutoFillResult =
  | { success: true; assigned: number; open: number; auditEntries: number }
  | { success: false; error: string }

function rolePriority(roleCode: string): number {
  const lc = roleCode.toLowerCase()
  if (lc.includes('nurse') || lc === 'rn') return 1
  if (lc.includes('senior')) return 2
  if (lc.includes('care') || lc.includes('support') || lc.includes('worker')) return 3
  return 4
}

// Hard-gate training codes (mirrors eligibility-check.ts)
const TRAINING_RULES: { code: string; roleFilter: string[] | null }[] = [
  { code: 'SAFEGUARD', roleFilter: null },
  { code: 'MAN_HANDLE', roleFilter: null },
  { code: 'MED_ADMIN', roleFilter: ['senior_care', 'nurse', 'rn'] },
  { code: 'BLS', roleFilter: null },
]

function isNightShift(startTimeLocal: string, lengthType: string): boolean {
  const hour = parseInt(startTimeLocal.split(':')[0] ?? '7', 10)
  return lengthType === 'sleep_in' || hour >= 20 || hour < 6
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB
}

function gap11hBreached(
  newStart: Date,
  newEnd: Date,
  existingStart: Date,
  existingEnd: Date
): boolean {
  const gapAfter = (newStart.getTime() - existingEnd.getTime()) / 3_600_000
  const gapBefore = (existingStart.getTime() - newEnd.getTime()) / 3_600_000
  return (gapAfter >= 0 && gapAfter < 11) || (gapBefore >= 0 && gapBefore < 11)
}

type ConfirmedShift = { startUtc: Date; endUtc: Date; paidHours: number }

export async function autoFillPeriod(
  supabase: AnyClient,
  homeId: string,
  periodId: string,
  userId: string
): Promise<AutoFillResult> {
  const { data: period } = await supabase
    .from('rota_periods')
    .select('id, period_start_date, period_end_date, status')
    .eq('id', periodId)
    .eq('home_id', homeId)
    .single()

  if (!period) return { success: false, error: 'Period not found' }
  if (period.status !== 'draft') return { success: false, error: 'Period is not a draft' }

  const periodStart = new Date(period.period_start_date)
  const periodEnd = new Date(period.period_end_date)

  const wtr17WeeksAgo = new Date(periodStart)
  wtr17WeeksAgo.setDate(wtr17WeeksAgo.getDate() - 17 * 7)

  // Pre-fence for 11h rest look-back: shifts ending up to 11h before period start
  const restLookbackStart = new Date(periodStart.getTime() - 11 * 3_600_000)

  // ── 1. Fetch slots + unassigned shifts ────────────────────────────────
  const { data: slots } = await supabase
    .from('shift_slots')
    .select('id, date, role_code, headcount_required, shift_pattern_template_id, shift_pattern_templates(start_time_local, end_time_local, paid_hours_decimal, length_type)')
    .eq('rota_period_id', periodId)

  if (!slots?.length) return { success: true, assigned: 0, open: 0, auditEntries: 0 }

  const slotIds = slots.map((s: { id: string }) => s.id)

  const { data: periodShiftsRaw } = await supabase
    .from('shifts')
    .select('id, shift_slot_id, staff_id, state, planned_start_utc, planned_end_utc, planned_paid_hours')
    .in('shift_slot_id', slotIds)
    .not('state', 'eq', 'cancelled')

  const periodShifts: Array<{
    id: string; shift_slot_id: string; staff_id: string | null; state: string;
    planned_start_utc: string; planned_end_utc: string; planned_paid_hours: number
  }> = periodShiftsRaw ?? []

  // ── 2. Get active staff list ──────────────────────────────────────────
  const { data: staffList } = await supabase
    .from('staff')
    .select('id, first_name, last_name, overtime_weighting, overtime_eligible')
    .eq('home_id', homeId)
    .eq('status', 'active')

  if (!staffList?.length) return { success: true, assigned: 0, open: 0, auditEntries: 0 }
  const staffIds = staffList.map((s: { id: string }) => s.id)

  // ── 3. Bulk-fetch all staff-related data in parallel ──────────────────
  const [
    contractsRes,
    leaveRes,
    sicknessRes,
    certsRes,
    docsRes,
    histShiftsRes,
    preShiftsRes,
    lastAllocRes,
  ] = await Promise.all([
    supabase.from('staff_contracts')
      .select('staff_id, contracted_hours_per_week, shift_pattern_preference, effective_from, effective_to')
      .in('staff_id', staffIds),

    supabase.from('leave_requests')
      .select('staff_id, start_date, end_date')
      .in('staff_id', staffIds)
      .eq('status', 'approved')
      .lte('start_date', period.period_end_date)
      .gte('end_date', period.period_start_date),

    supabase.from('sickness_episodes')
      .select('staff_id, first_day_of_sickness, last_day_of_sickness')
      .in('staff_id', staffIds)
      .lte('first_day_of_sickness', period.period_end_date)
      .or(`last_day_of_sickness.is.null,last_day_of_sickness.gte.${period.period_start_date}`),

    supabase.from('staff_training_certs')
      .select('staff_id, expiry_date, training_topics(code)')
      .in('staff_id', staffIds),

    supabase.from('staff_documents')
      .select('staff_id, doc_type, expiry_date')
      .in('staff_id', staffIds)
      .in('doc_type', ['passport', 'biometric_residence_permit', 'share_code']),

    // 17-week history for WTR 48h rolling average
    supabase.from('shifts')
      .select('staff_id, planned_start_utc, planned_paid_hours')
      .in('staff_id', staffIds)
      .gte('planned_start_utc', wtr17WeeksAgo.toISOString())
      .lt('planned_start_utc', periodStart.toISOString())
      .not('state', 'in', '("cancelled","no_show")'),

    // Shifts near period boundary for 11h rest look-back
    supabase.from('shifts')
      .select('staff_id, planned_start_utc, planned_end_utc, planned_paid_hours')
      .in('staff_id', staffIds)
      .gte('planned_start_utc', restLookbackStart.toISOString())
      .lt('planned_start_utc', periodStart.toISOString())
      .not('state', 'in', '("cancelled","no_show")'),

    // Most recent shift per staff for tie-breaker (latest overtime allocation)
    supabase.from('shifts')
      .select('staff_id, planned_start_utc')
      .in('staff_id', staffIds)
      .lt('planned_start_utc', periodStart.toISOString())
      .not('state', 'in', '("cancelled","no_show")')
      .order('planned_start_utc', { ascending: false })
      .limit(staffIds.length * 3), // roughly one recent entry per person
  ])

  // ── 4. Build lookup maps ──────────────────────────────────────────────

  // Active contract per staff (most recent covering the period)
  const contractsByStaff = new Map<string, {
    contracted_hours_per_week: number;
    shift_pattern_preference: string;
  }>()
  for (const c of contractsRes.data ?? []) {
    const from = new Date(c.effective_from)
    const to = c.effective_to ? new Date(c.effective_to) : null
    if (from <= periodEnd && (to === null || to > periodStart)) {
      if (!contractsByStaff.has(c.staff_id)) {
        contractsByStaff.set(c.staff_id, {
          contracted_hours_per_week: c.contracted_hours_per_week,
          shift_pattern_preference: c.shift_pattern_preference ?? 'any',
        })
      }
    }
  }

  // Approved leave intervals per staff
  const leaveByStaff = new Map<string, Array<{ start: string; end: string }>>()
  for (const lr of leaveRes.data ?? []) {
    const arr = leaveByStaff.get(lr.staff_id) ?? []
    arr.push({ start: lr.start_date, end: lr.end_date })
    leaveByStaff.set(lr.staff_id, arr)
  }

  // Sickness intervals per staff
  const sickByStaff = new Map<string, Array<{ start: string; end: string | null }>>()
  for (const se of sicknessRes.data ?? []) {
    const arr = sickByStaff.get(se.staff_id) ?? []
    arr.push({ start: se.first_day_of_sickness, end: se.last_day_of_sickness })
    sickByStaff.set(se.staff_id, arr)
  }

  // Training certs: staff_id → Map<topicCode, expiry | null>
  const certsByStaff = new Map<string, Map<string, Date | null>>()
  for (const cert of certsRes.data ?? []) {
    const topicRaw = cert.training_topics
    const topic = Array.isArray(topicRaw) ? topicRaw[0] : topicRaw
    if (!topic?.code) continue
    if (!certsByStaff.has(cert.staff_id)) certsByStaff.set(cert.staff_id, new Map())
    certsByStaff.get(cert.staff_id)!.set(
      topic.code,
      cert.expiry_date ? new Date(cert.expiry_date) : null
    )
  }

  // RTW docs: staff_id → has valid doc boolean
  const rtwByStaff = new Map<string, boolean>()
  for (const doc of docsRes.data ?? []) {
    if (!rtwByStaff.has(doc.staff_id)) {
      const valid = !doc.expiry_date || new Date(doc.expiry_date) >= periodStart
      if (valid) rtwByStaff.set(doc.staff_id, true)
    }
  }

  // Historical weekly totals per staff for WTR (Map<staffId, Map<weekKey, hours>>)
  const weeklyHistByStaff = new Map<string, Map<string, number>>()
  for (const hs of histShiftsRes.data ?? []) {
    if (!weeklyHistByStaff.has(hs.staff_id)) weeklyHistByStaff.set(hs.staff_id, new Map())
    const d = new Date(hs.planned_start_utc)
    const thu = new Date(d)
    thu.setDate(thu.getDate() + 3 - ((thu.getDay() + 6) % 7))
    const wk = `${thu.getFullYear()}-W${String(Math.ceil((((thu.getTime() - new Date(thu.getFullYear(), 0, 4).getTime()) / 86400000) + 1) / 7)).padStart(2, '0')}`
    const m = weeklyHistByStaff.get(hs.staff_id)!
    m.set(wk, (m.get(wk) ?? 0) + Number(hs.planned_paid_hours))
  }

  // Pre-period shifts for 11h rest check
  const prePeriodShiftsByStaff = new Map<string, ConfirmedShift[]>()
  for (const ps of preShiftsRes.data ?? []) {
    if (!prePeriodShiftsByStaff.has(ps.staff_id)) prePeriodShiftsByStaff.set(ps.staff_id, [])
    const s = new Date(ps.planned_start_utc)
    const e = new Date(ps.planned_end_utc)
    prePeriodShiftsByStaff.get(ps.staff_id)!.push({ startUtc: s, endUtc: e, paidHours: Number(ps.planned_paid_hours) })
  }

  // Last allocation date per staff (for tie-breaker)
  const lastAllocByStaff = new Map<string, Date>()
  for (const la of lastAllocRes.data ?? []) {
    if (!lastAllocByStaff.has(la.staff_id)) {
      lastAllocByStaff.set(la.staff_id, new Date(la.planned_start_utc))
    }
  }

  // Staff overview map
  const staffById = new Map<string, { id: string; overtime_weighting: number; overtime_eligible?: boolean }>(
    staffList.map((s: { id: string; overtime_weighting: number; overtime_eligible?: boolean }) => [s.id, s])
  )

  // ── 5. Running state for the fill loop ───────────────────────────────

  // Period hours accumulated per staff (starts from already-assigned pre-fill shifts)
  const periodHoursByStaff = new Map<string, number>()
  const confirmedByStaff = new Map<string, ConfirmedShift[]>()

  for (const sid of staffIds) {
    confirmedByStaff.set(sid, [...(prePeriodShiftsByStaff.get(sid) ?? [])])
    periodHoursByStaff.set(sid, 0)
  }

  // Seed period hours from already-assigned (pre-filled) shifts
  for (const sh of periodShifts) {
    if (sh.staff_id && sh.state === 'assigned') {
      periodHoursByStaff.set(sh.staff_id, (periodHoursByStaff.get(sh.staff_id) ?? 0) + Number(sh.planned_paid_hours))
      confirmedByStaff.get(sh.staff_id)?.push({
        startUtc: new Date(sh.planned_start_utc),
        endUtc: new Date(sh.planned_end_utc),
        paidHours: Number(sh.planned_paid_hours),
      })
    }
  }

  // ── 6. Sort slots: role priority, then date, then start time ─────────
  const shiftsBySlotId = new Map<string, typeof periodShifts>()
  for (const sh of periodShifts) {
    if (!shiftsBySlotId.has(sh.shift_slot_id)) shiftsBySlotId.set(sh.shift_slot_id, [])
    shiftsBySlotId.get(sh.shift_slot_id)!.push(sh)
  }

  type SlotLite = {
    role_code: string
    date: string
    shift_pattern_templates:
      | { paid_hours_decimal: number; start_time_local: string }
      | { paid_hours_decimal: number; start_time_local: string }[]
      | null
  }
  const slotTmpl = (s: SlotLite) =>
    Array.isArray(s.shift_pattern_templates) ? s.shift_pattern_templates[0] : s.shift_pattern_templates
  const slotHours = (s: SlotLite): number => Number(slotTmpl(s)?.paid_hours_decimal ?? 0)
  const slotStart = (s: SlotLite): string => slotTmpl(s)?.start_time_local ?? '00:00'
  // Role priority, then date, then LONGEST shift first, then EARLIEST start. Filling long shifts
  // before short ones means staff with the most room take the full days; filling morning before
  // afternoon means the afternoon half can be paired to whoever already has that morning.
  const sortedSlots = [...slots].sort((a: SlotLite, b: SlotLite) => {
    const rDiff = rolePriority(a.role_code) - rolePriority(b.role_code)
    if (rDiff !== 0) return rDiff
    const dDiff = a.date.localeCompare(b.date)
    if (dDiff !== 0) return dDiff
    const hDiff = slotHours(b) - slotHours(a)
    if (hDiff !== 0) return hDiff
    return slotStart(a).localeCompare(slotStart(b))
  })

  // ── 7. Main fill loop ─────────────────────────────────────────────────
  const assignments: Array<{ shiftId: string; staffId: string; paidHours: number; startUtc: Date; endUtc: Date }> = []
  const auditRows: Array<{
    tenant_id: string; home_id: string; rota_period_id: string; shift_id: string;
    staff_id: string | null; candidates_evaluated: number; selected_reason: string | null;
    ranking_json: unknown; generated_by_user_id: string;
  }> = []

  const periodWeeksCount = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (7 * 24 * 3_600_000)))

  for (const slot of sortedSlots) {
    const template = Array.isArray(slot.shift_pattern_templates)
      ? slot.shift_pattern_templates[0]
      : slot.shift_pattern_templates
    if (!template) continue

    const slotShifts = shiftsBySlotId.get(slot.id) ?? []
    const unassignedShifts = slotShifts.filter((sh: { state: string }) => sh.state === 'unassigned')
    if (!unassignedShifts.length) continue

    const shiftDate = new Date(slot.date)
    const isNight = isNightShift(template.start_time_local, template.length_type)

    for (const shift of unassignedShifts) {
      const shiftStart = new Date(shift.planned_start_utc)
      const shiftEnd = new Date(shift.planned_end_utc)
      const shiftHours = Number(shift.planned_paid_hours)

      // An afternoon half-shift (short day shift starting midday or later) is only ever paired to
      // someone who already holds that morning — so no one gets an afternoon without the morning.
      const isAfternoonHalf = !isNight && shiftHours <= 7 && shiftStart.getUTCHours() >= 12

      // Evaluate each staff member as a candidate
      const ranked: Array<{ staffId: string; overtimeAdded: number; hoursDeficit: number; weighting: number; lastAlloc: number; reason: string }> = []

      for (const staff of staffList) {
        const sid = staff.id
        const contract = contractsByStaff.get(sid)
        if (!contract) continue // no active contract

        // --- Filter: afternoon half must be paired to that morning ---
        if (isAfternoonHalf) {
          const confirmed = confirmedByStaff.get(sid) ?? []
          const hasMorningSameDay = confirmed.some(cs =>
            cs.startUtc.toISOString().slice(0, 10) === slot.date &&
            cs.startUtc.getUTCHours() < 12 &&
            cs.endUtc.getTime() <= shiftStart.getTime()
          )
          if (!hasMorningSameDay) continue
        }

        // --- Filter: shift pattern preference ---
        const pref = contract.shift_pattern_preference
        if (pref === 'day_only' && isNight) continue
        if (pref === 'night_only' && !isNight) continue
        if (pref === 'fixed') continue // fixed staff are pre-filled only

        // --- Filter: on approved leave ---
        const leaves = leaveByStaff.get(sid) ?? []
        if (leaves.some(l => l.start <= slot.date && l.end >= slot.date)) continue

        // --- Filter: on sick ---
        const sicks = sickByStaff.get(sid) ?? []
        if (sicks.some(se => se.start <= slot.date && (se.end === null || se.end >= slot.date))) continue

        // --- Filter: training gates ---
        const certs = certsByStaff.get(sid) ?? new Map()
        let trainingBlocked = false
        for (const rule of TRAINING_RULES) {
          if (rule.roleFilter) {
            const lc = slot.role_code.toLowerCase()
            if (!rule.roleFilter.some(r => lc.includes(r))) continue
          }
          const expiry = certs.get(rule.code)
          if (expiry === undefined) { trainingBlocked = true; break } // no cert
          if (expiry !== null && expiry < shiftDate) { trainingBlocked = true; break } // expired
        }
        if (trainingBlocked) continue

        // --- Filter: RTW ---
        if (!rtwByStaff.get(sid)) continue

        // --- Filter: 11h rest ---
        const confirmed = confirmedByStaff.get(sid) ?? []
        let restBreached = false
        for (const cs of confirmed) {
          if (gap11hBreached(shiftStart, shiftEnd, cs.startUtc, cs.endUtc)) {
            restBreached = true
            break
          }
        }
        if (restBreached) continue

        // --- Filter: WTR 48h weekly average ---
        const weeklyHist = weeklyHistByStaff.get(sid) ?? new Map<string, number>()
        const currentPeriodHours = (periodHoursByStaff.get(sid) ?? 0) + shiftHours
        const allWeeks = new Map(weeklyHist)
        // Approximate: spread period hours across weeks in the period
        const currentWeekHoursApprox = currentPeriodHours / periodWeeksCount
        allWeeks.set('__current__', currentWeekHoursApprox)
        const vals = Array.from(allWeeks.values())
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        if (avg > 48) continue

        // --- Filter: overtime eligibility ---
        // Staff who aren't overtime-eligible (ancillary roles by default) may work up to their
        // contracted hours, but must not be pushed into overtime. Skip if this shift would take
        // them over contract. Overtime is thereby confined to eligible (hands-on) staff.
        const contracted = contract.contracted_hours_per_week * periodWeeksCount
        const accumulated = periodHoursByStaff.get(sid) ?? 0
        const eligible = staffById.get(sid)?.overtime_eligible !== false
        if (!eligible && accumulated + shiftHours > contracted) continue

        // --- Rank ---
        // How much *overtime* this shift would add for this person: the hours it pushes them past
        // contract, over and above any overtime they already carry. Zero while they are still under
        // contract. Ranking on this minimises total overtime cost.
        const projected = accumulated + shiftHours
        const overtimeAdded = Math.max(0, projected - contracted) - Math.max(0, accumulated - contracted)
        const deficit = contracted - accumulated // higher deficit = more room under contract
        const weighting = staffById.get(sid)?.overtime_weighting ?? 50
        const lastAllocMs = lastAllocByStaff.get(sid)?.getTime() ?? 0

        ranked.push({
          staffId: sid,
          overtimeAdded,
          hoursDeficit: deficit,
          weighting,
          lastAlloc: lastAllocMs,
          reason: overtimeAdded > 0
            ? `+${overtimeAdded.toFixed(1)}h overtime (${accumulated.toFixed(1)}/${contracted.toFixed(0)}h); weighting ${weighting}`
            : `${deficit.toFixed(1)}h under contract; no overtime`,
        })
      }

      // Sort: least overtime added first, then most room under contract (level everyone up),
      // then highest overtime weighting, then oldest allocation. This keeps staff at their
      // contracted hours where possible and, when overtime is unavoidable, gives it to whoever
      // is nearest their contract and carries the higher overtime share.
      ranked.sort((a, b) => {
        if (a.overtimeAdded !== b.overtimeAdded) return a.overtimeAdded - b.overtimeAdded
        if (b.hoursDeficit !== a.hoursDeficit) return b.hoursDeficit - a.hoursDeficit
        if (b.weighting !== a.weighting) return b.weighting - a.weighting
        return a.lastAlloc - b.lastAlloc // oldest first
      })

      const selected = ranked[0] ?? null

      auditRows.push({
        tenant_id: homeId,
        home_id: homeId,
        rota_period_id: periodId,
        shift_id: shift.id,
        staff_id: selected?.staffId ?? null,
        candidates_evaluated: ranked.length,
        selected_reason: selected?.reason ?? 'No eligible candidates',
        ranking_json: ranked.slice(0, 10).map(r => ({ staffId: r.staffId, overtimeAdded: r.overtimeAdded, deficit: r.hoursDeficit, weighting: r.weighting })),
        generated_by_user_id: userId,
      })

      if (selected) {
        assignments.push({ shiftId: shift.id, staffId: selected.staffId, paidHours: shiftHours, startUtc: shiftStart, endUtc: shiftEnd })
        // Update running state
        periodHoursByStaff.set(selected.staffId, (periodHoursByStaff.get(selected.staffId) ?? 0) + shiftHours)
        confirmedByStaff.get(selected.staffId)?.push({ startUtc: shiftStart, endUtc: shiftEnd, paidHours: shiftHours })
        lastAllocByStaff.set(selected.staffId, shiftStart)
      }
    }
  }

  // ── 8. Bulk write assignments ─────────────────────────────────────────
  let dbError: string | null = null

  for (const asgn of assignments) {
    const { error } = await supabase
      .from('shifts')
      .update({ staff_id: asgn.staffId, state: 'assigned', updated_by_user_id: userId })
      .eq('id', asgn.shiftId)

    if (error) { dbError = error.message; break }
  }

  if (dbError) return { success: false, error: dbError }

  // ── 9. Write audit rows ───────────────────────────────────────────────
  if (auditRows.length > 0) {
    await supabase.from('rota_generation_audit').insert(auditRows)
  }

  const openSlots = periodShifts.filter((sh: { state: string }) => sh.state === 'unassigned').length - assignments.length

  return {
    success: true,
    assigned: assignments.length,
    open: Math.max(0, openSlots),
    auditEntries: auditRows.length,
  }
}
