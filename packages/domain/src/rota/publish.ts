import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export type PublishBlock = {
  shift_id: string
  rule_code: string
  message: string
}

export type PublishResult =
  | { success: true }
  | { success: false; error: string; blocks?: PublishBlock[] }

export async function publishRotaPeriod(
  supabase: AnyClient,
  homeId: string,
  periodId: string,
  userId: string
): Promise<PublishResult> {
  // Verify period belongs to home and is draft
  const { data: period } = await supabase
    .from('rota_periods')
    .select('id, status, period_start_date, period_end_date')
    .eq('id', periodId)
    .eq('home_id', homeId)
    .single()

  if (!period) return { success: false, error: 'Period not found' }
  if (period.status !== 'draft') return { success: false, error: `Period is already ${period.status}` }

  // Fetch home registration type for RN cover check
  const { data: home } = await supabase
    .from('homes')
    .select('registration_type')
    .eq('id', homeId)
    .single()

  // Fetch all assigned shifts in this period
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, staff_id, state, planned_start_utc, planned_end_utc, shift_slot_id')
    .in(
      'shift_slot_id',
      (
        await supabase
          .from('shift_slots')
          .select('id')
          .eq('rota_period_id', periodId)
      ).data?.map(s => s.id) ?? []
    )

  const allShifts = shifts ?? []
  const blocks: PublishBlock[] = []

  // Check: no active overrides pending co-sign (not blocking publish — just a flag, not implemented here)

  // RN cover check for nursing/dual homes
  if (home?.registration_type === 'nursing' || home?.registration_type === 'dual' as string) {
    // Group assigned shifts by date
    const dateGroups = new Map<string, typeof allShifts>()
    for (const s of allShifts) {
      if (s.staff_id && s.state !== 'cancelled') {
        const date = s.planned_start_utc.split('T')[0]!
        const existing = dateGroups.get(date) ?? []
        existing.push(s)
        dateGroups.set(date, existing)
      }
    }

    // Check each date for at least one nurse
    for (const [date, dayShifts] of dateGroups) {
      // Fetch staff roles for assigned staff
      const staffIds = [...new Set(dayShifts.map(s => s.staff_id).filter(Boolean))] as string[]
      if (staffIds.length === 0) continue

      const { data: staffRoles } = await supabase
        .from('staff_contracts')
        .select('staff_id')
        .in('staff_id', staffIds)
        .lte('effective_from', date)
        .or('effective_to.is.null,effective_to.gt.' + date)

      // Simple heuristic: we'd normally check staff_roles.code for 'nurse'/'RN'
      // For now we check if any assigned slot role_code contains 'nurse'
      const { data: slotRoles } = await supabase
        .from('shift_slots')
        .select('id, role_code')
        .in('id', dayShifts.map(s => s.shift_slot_id))

      const hasNurse = (slotRoles ?? []).some(r =>
        r.role_code?.toLowerCase().includes('nurse') || r.role_code?.toLowerCase().includes('rn')
      )

      if (!hasNurse) {
        // Find any shift ID for this date to attach the block to
        const representativeShift = dayShifts[0]
        if (representativeShift) {
          blocks.push({
            shift_id: representativeShift.id,
            rule_code: 'nursing_rn_cover_gap',
            message: `No registered nurse assigned on ${date}.`,
          })
        }
      }
    }
  }

  if (blocks.length > 0) {
    return { success: false, error: 'Publish blocked', blocks }
  }

  // Stamp premium pay on all assigned shifts
  const { data: premiumDates } = await supabase
    .from('premium_pay_calendar')
    .select('calendar_date, multiplier, name')
    .eq('home_id', homeId)
    .gte('calendar_date', period.period_start_date)
    .lte('calendar_date', period.period_end_date)

  const premiumMap = new Map((premiumDates ?? []).map(p => [p.calendar_date, p]))

  // Christmas period dates (24–26 Dec, 31 Dec, 1 Jan)
  const christmasDates = new Set<string>()
  for (const p of premiumDates ?? []) {
    const d = p.calendar_date
    if (d.endsWith('-12-24') || d.endsWith('-12-25') || d.endsWith('-12-26') ||
        d.endsWith('-12-31') || d.endsWith('-01-01')) {
      christmasDates.add(d)
    }
  }

  // Update each assigned shift with premium pay data (frozen at publish time)
  const assignedShifts = allShifts.filter(s => s.staff_id && s.state === 'assigned')
  for (const shift of assignedShifts) {
    const shiftDate = shift.planned_start_utc.split('T')[0]!
    const premium = premiumMap.get(shiftDate)
    await supabase
      .from('shifts')
      .update({
        is_bank_holiday: !!premium && !christmasDates.has(shiftDate),
        is_christmas_period: christmasDates.has(shiftDate),
        premium_multiplier: premium ? premium.multiplier : 1.00,
        updated_by_user_id: userId,
      })
      .eq('id', shift.id)
  }

  // Transition period to published
  const { error: pubError } = await supabase
    .from('rota_periods')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_by_user_id: userId,
      updated_by_user_id: userId,
    })
    .eq('id', periodId)

  if (pubError) return { success: false, error: pubError.message }

  return { success: true }
}
