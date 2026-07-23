import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export type OverridePath =
  | 'registered_manager'          // RM or deputy
  | 'registered_manager_only'     // RM only
  | 'rm_and_owner_24h'            // RM + owner co-sign within 24h
  | 'soft_warn'                   // any manager can confirm
  | 'none'                        // absolute block — no override

export type RuleBlock = {
  rule_code: string
  message: string
  override_path: OverridePath
}

export type EligibilityResult = {
  eligible: boolean
  blocks: RuleBlock[]
  warnings: RuleBlock[]
}

type CheckInput = {
  homeId: string
  staffId: string
  shiftDate: string       // YYYY-MM-DD
  plannedStartUtc: string // ISO timestamp
  plannedEndUtc: string   // ISO timestamp
  roleCode: string
  shiftTemplateId: string
}

// Training topic codes that map to hard rules
const TRAINING_RULE_MAP: Array<{ code: string; rule_code: string; role_filter?: string[] }> = [
  { code: 'SAFEGUARD', rule_code: 'training_expired_safeguarding' },
  { code: 'MAN_HANDLE', rule_code: 'training_expired_moving_handling' },
  { code: 'MED_ADMIN', rule_code: 'training_expired_medication', role_filter: ['senior_care', 'nurse', 'SENIOR_CARE', 'NURSE', 'RN'] },
  { code: 'BLS', rule_code: 'training_expired_bls' },
]

export async function checkShiftEligibility(
  supabase: AnyClient,
  input: CheckInput
): Promise<EligibilityResult> {
  const { homeId, staffId, shiftDate, plannedStartUtc, plannedEndUtc, roleCode, shiftTemplateId } = input

  const shiftDateObj = new Date(shiftDate)
  const startUtc = new Date(plannedStartUtc)
  const endUtc = new Date(plannedEndUtc)
  const shiftHours = (endUtc.getTime() - startUtc.getTime()) / 3_600_000

  // Window for 17-week WTR calculation
  const wtr17Start = new Date(shiftDateObj)
  wtr17Start.setDate(wtr17Start.getDate() - 17 * 7)

  // Window for 11hr rest check: ±36h around the new shift
  const restWindowStart = new Date(startUtc.getTime() - 36 * 3_600_000)
  const restWindowEnd = new Date(endUtc.getTime() + 36 * 3_600_000)

  // Week bounds for sponsorship hours check (Mon–Sun containing shiftDate)
  const weekStart = new Date(shiftDateObj)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)) // Monday
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const [
    contractRes,
    trainingRes,
    documentsRes,
    nearbyShiftsRes,
    historicShiftsRes,
    weekShiftsRes,
    sponsorshipRes,
    templateRes,
  ] = await Promise.all([
    // Active contracts
    supabase
      .from('staff_contracts')
      .select('contract_type, effective_from, effective_to, contracted_hours_per_week, shift_pattern_preference')
      .eq('staff_id', staffId)
      .lte('effective_from', shiftDate)
      .order('effective_from', { ascending: false })
      .limit(5),

    // Training certs with topic codes
    supabase
      .from('staff_training_certs')
      .select('expiry_date, training_topics(code)')
      .eq('staff_id', staffId),

    // RTW documents
    supabase
      .from('staff_documents')
      .select('doc_type, expiry_date')
      .eq('staff_id', staffId)
      .in('doc_type', ['passport', 'biometric_residence_permit', 'share_code']),

    // Nearby shifts for 11hr rest
    supabase
      .from('shifts')
      .select('planned_start_utc, planned_end_utc, planned_paid_hours')
      .eq('staff_id', staffId)
      .eq('home_id', homeId)
      .gte('planned_start_utc', restWindowStart.toISOString())
      .lte('planned_start_utc', restWindowEnd.toISOString())
      .not('state', 'in', '("cancelled","no_show")'),

    // 17-week historic shifts for WTR average
    supabase
      .from('shifts')
      .select('planned_start_utc, planned_paid_hours')
      .eq('staff_id', staffId)
      .gte('planned_start_utc', wtr17Start.toISOString())
      .lt('planned_start_utc', plannedStartUtc)
      .not('state', 'in', '("cancelled","no_show")'),

    // Week shifts for sponsorship check
    supabase
      .from('shifts')
      .select('planned_paid_hours')
      .eq('staff_id', staffId)
      .eq('home_id', homeId)
      .gte('planned_start_utc', weekStart.toISOString())
      .lt('planned_start_utc', weekEnd.toISOString())
      .not('state', 'in', '("cancelled","no_show")'),

    // Sponsorship record
    supabase
      .from('staff_sponsorship')
      .select('minimum_hours_per_week, cos_start_date, cos_end_date')
      .eq('staff_id', staffId)
      .lte('cos_start_date', shiftDate)
      .gte('cos_end_date', shiftDate)
      .maybeSingle(),

    // Shift template (for preference check)
    supabase
      .from('shift_pattern_templates')
      .select('start_time_local, end_time_local, length_type')
      .eq('id', shiftTemplateId)
      .single(),
  ])

  const blocks: RuleBlock[] = []
  const warnings: RuleBlock[] = []

  // ── Rule 1: contract_inactive ────────────────────────────────────────
  const contracts = contractRes.data ?? []
  const activeContract = contracts.find(c => {
    const from = new Date(c.effective_from)
    const to = c.effective_to ? new Date(c.effective_to) : null
    return from <= shiftDateObj && (to === null || to > shiftDateObj)
  })

  if (!activeContract) {
    blocks.push({
      rule_code: 'contract_inactive',
      message: 'No active contract covers this shift date.',
      override_path: 'none',
    })
    // Return early — remaining checks need contract data
    return { eligible: false, blocks, warnings }
  }

  // ── Rule 2: staff_pattern_preference (soft warn) ─────────────────────
  const pref = activeContract.shift_pattern_preference
  const template = templateRes.data
  if (template && pref !== 'any' && pref !== 'fixed') {
    const startHour = parseInt(template.start_time_local.split(':')[0] ?? '7', 10)
    const isNight = template.length_type === 'sleep_in' || startHour >= 20 || startHour < 6
    if (pref === 'day_only' && isNight) {
      warnings.push({
        rule_code: 'staff_pattern_preference',
        message: `${staffId}'s contract preference is days only — this is a night shift.`,
        override_path: 'soft_warn',
      })
    }
    if (pref === 'night_only' && !isNight) {
      warnings.push({
        rule_code: 'staff_pattern_preference',
        message: `Staff preference is nights only — this is a day shift.`,
        override_path: 'soft_warn',
      })
    }
  }

  // ── Rule 3: wtr_11hr_rest ────────────────────────────────────────────
  const nearbyShifts = nearbyShiftsRes.data ?? []
  for (const s of nearbyShifts) {
    const existStart = new Date(s.planned_start_utc)
    const existEnd = new Date(existStart.getTime() + s.planned_paid_hours * 3_600_000)
    const gapAfter = (startUtc.getTime() - existEnd.getTime()) / 3_600_000
    const gapBefore = (existStart.getTime() - endUtc.getTime()) / 3_600_000
    if ((gapAfter >= 0 && gapAfter < 11) || (gapBefore >= 0 && gapBefore < 11)) {
      blocks.push({
        rule_code: 'wtr_11hr_rest',
        message: `Less than 11 hours rest between shifts (gap: ${Math.round(Math.min(gapAfter >= 0 ? gapAfter : Infinity, gapBefore >= 0 ? gapBefore : Infinity))}h).`,
        override_path: 'registered_manager',
      })
      break
    }
  }

  // ── Rule 4: wtr_48hr_weekly ──────────────────────────────────────────
  const historicShifts = historicShiftsRes.data ?? []
  // Group by ISO week and compute weekly totals
  const weeklyTotals = new Map<string, number>()
  for (const s of historicShifts) {
    const d = new Date(s.planned_start_utc)
    // ISO week key: year-Www
    const thursday = new Date(d)
    thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7))
    const weekKey = `${thursday.getFullYear()}-W${String(Math.ceil((((thursday.getTime() - new Date(thursday.getFullYear(), 0, 4).getTime()) / 86400000) + 1) / 7)).padStart(2, '0')}`
    weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) ?? 0) + Number(s.planned_paid_hours))
  }
  // Add current week's contribution including this new shift
  const currentWeekKey = 'current'
  const currentWeekHours = (weekShiftsRes.data ?? []).reduce((sum, s) => sum + Number(s.planned_paid_hours), 0) + shiftHours
  weeklyTotals.set(currentWeekKey, currentWeekHours)

  const totalsArr = Array.from(weeklyTotals.values())
  const avgHours = totalsArr.length > 0 ? totalsArr.reduce((a, b) => a + b, 0) / totalsArr.length : 0

  if (avgHours > 48) {
    blocks.push({
      rule_code: 'wtr_48hr_weekly',
      message: `17-week rolling average would be ${avgHours.toFixed(1)}h/wk (limit: 48h).`,
      override_path: 'registered_manager_only',
    })
  }

  // ── Rule 5: training checks ──────────────────────────────────────────
  const certs = trainingRes.data ?? []
  const certsByCode = new Map<string, Date | null>()
  for (const c of certs) {
    const topics = Array.isArray(c.training_topics)
      ? (c.training_topics[0] as { code: string } | undefined) ?? null
      : c.training_topics as { code: string } | null
    if (topics?.code) {
      certsByCode.set(topics.code, c.expiry_date ? new Date(c.expiry_date) : null)
    }
  }

  for (const { code, rule_code, role_filter } of TRAINING_RULE_MAP) {
    if (role_filter && !role_filter.some(r => roleCode.toLowerCase().includes(r.toLowerCase()))) {
      continue // rule only applies to certain roles
    }
    const expiry = certsByCode.get(code)
    if (expiry === undefined) {
      // No cert at all
      blocks.push({
        rule_code,
        message: `No ${code} certificate on record.`,
        override_path: 'registered_manager_only',
      })
    } else if (expiry !== null && expiry < shiftDateObj) {
      blocks.push({
        rule_code,
        message: `${code} certificate expired ${expiry.toLocaleDateString('en-GB')}.`,
        override_path: 'registered_manager_only',
      })
    }
  }

  // ── Rule 6: rtw_expired ──────────────────────────────────────────────
  const rtwDocs = documentsRes.data ?? []
  const hasValidRtw = rtwDocs.some(d => !d.expiry_date || new Date(d.expiry_date) >= shiftDateObj)

  if (!hasValidRtw && rtwDocs.length === 0) {
    // No RTW doc at all — block
    blocks.push({
      rule_code: 'rtw_expired',
      message: 'No right-to-work document on record.',
      override_path: 'rm_and_owner_24h',
    })
  } else if (!hasValidRtw) {
    blocks.push({
      rule_code: 'rtw_expired',
      message: 'Right-to-work document has expired.',
      override_path: 'rm_and_owner_24h',
    })
  }

  // ── Rule 7: sponsorship_hours_floor ─────────────────────────────────
  const sponsorship = sponsorshipRes.data
  if (sponsorship) {
    const weekHoursTotal = currentWeekHours // already computed above
    if (weekHoursTotal < Number(sponsorship.minimum_hours_per_week)) {
      blocks.push({
        rule_code: 'sponsorship_hours_floor',
        message: `Week total would be ${weekHoursTotal.toFixed(1)}h — below CoS minimum of ${sponsorship.minimum_hours_per_week}h.`,
        override_path: 'registered_manager_only',
      })
    }
  }

  const eligible = blocks.length === 0
  return { eligible, blocks, warnings }
}
