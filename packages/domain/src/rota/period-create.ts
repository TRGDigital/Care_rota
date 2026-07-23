import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export type CreatePeriodResult =
  | { success: true; periodId: string; slotsCreated: number; shiftsPreFilled: number }
  | { success: false; error: string }

export async function createRotaPeriod(
  supabase: AnyClient,
  homeId: string,
  userId: string
): Promise<CreatePeriodResult> {
  // Fetch home config
  const { data: home } = await supabase
    .from('homes')
    .select('rota_period_weeks, rota_start_day, time_zone')
    .eq('id', homeId)
    .single()

  if (!home) return { success: false, error: 'Home not found' }

  const periodWeeks: number = home.rota_period_weeks ?? 1
  const startDay: number = home.rota_start_day ?? 1 // 1=Mon

  // Find the next period start (next occurrence of startDay after the last period)
  const { data: lastPeriod } = await supabase
    .from('rota_periods')
    .select('period_end_date')
    .eq('home_id', homeId)
    .order('period_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const today = new Date()
  let periodStart: Date

  if (lastPeriod?.period_end_date) {
    // Start the day after the last period ends
    periodStart = new Date(lastPeriod.period_end_date)
    periodStart.setDate(periodStart.getDate() + 1)
  } else {
    // No periods yet — find next Monday (or configured start day) from today
    periodStart = new Date(today)
    const dayOfWeek = periodStart.getDay()
    const daysUntilStart = (startDay - dayOfWeek + 7) % 7
    periodStart.setDate(periodStart.getDate() + (daysUntilStart === 0 ? 7 : daysUntilStart))
  }

  const periodEnd = new Date(periodStart)
  periodEnd.setDate(periodEnd.getDate() + periodWeeks * 7 - 1)

  const periodStartStr = periodStart.toISOString().split('T')[0]!
  const periodEndStr = periodEnd.toISOString().split('T')[0]!

  // Create the period record
  const { data: period, error: periodError } = await supabase
    .from('rota_periods')
    .insert({
      home_id: homeId,
      tenant_id: homeId,
      period_start_date: periodStartStr,
      period_end_date: periodEndStr,
      status: 'draft',
      created_by_user_id: userId,
    })
    .select('id')
    .single()

  if (periodError || !period) return { success: false, error: periodError?.message ?? 'Failed to create period' }

  const periodId = period.id

  // Fetch slot requirements for this home
  const { data: requirements } = await supabase
    .from('rota_slot_requirements')
    .select('day_of_week, shift_pattern_template_id, role_code, headcount_required')
    .eq('home_id', homeId)

  // Fetch templates for UTC time calculation
  const templateIds = [...new Set((requirements ?? []).map(r => r.shift_pattern_template_id))]
  const { data: templates } = templateIds.length
    ? await supabase
        .from('shift_pattern_templates')
        .select('id, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type')
        .in('id', templateIds)
    : { data: [] }

  const templateMap = new Map((templates ?? []).map(t => [t.id, t]))

  // Generate shift_slots and shifts for each day in the period
  const slotInserts: object[] = []
  const shiftInserts: object[] = []

  const cursor = new Date(periodStart)
  while (cursor <= periodEnd) {
    const dayOfWeek = cursor.getDay()
    const dateStr = cursor.toISOString().split('T')[0]!

    const dayReqs = (requirements ?? []).filter(r => r.day_of_week === dayOfWeek)

    for (const req of dayReqs) {
      const tmpl = templateMap.get(req.shift_pattern_template_id)
      if (!tmpl) continue

      // Insert shift_slot — one per (date × template × role)
      const slotId = crypto.randomUUID()
      slotInserts.push({
        id: slotId,
        home_id: homeId,
        tenant_id: homeId,
        rota_period_id: periodId,
        date: dateStr,
        shift_pattern_template_id: req.shift_pattern_template_id,
        role_code: req.role_code,
        headcount_required: req.headcount_required,
        created_by_user_id: userId,
      })

      // Create headcount_required unassigned shifts per slot
      const [startHour, startMin] = tmpl.start_time_local.split(':').map(Number)
      const [endHour, endMin] = tmpl.end_time_local.split(':').map(Number)

      const shiftStart = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`)
      let shiftEnd = new Date(`${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`)
      if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1) // overnight

      for (let i = 0; i < req.headcount_required; i++) {
        shiftInserts.push({
          home_id: homeId,
          tenant_id: homeId,
          shift_slot_id: slotId,
          state: 'unassigned',
          planned_start_utc: shiftStart.toISOString(),
          planned_end_utc: shiftEnd.toISOString(),
          planned_break_minutes: tmpl.break_minutes,
          planned_paid_hours: tmpl.paid_hours_decimal,
          created_by_user_id: userId,
        })
      }
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  // Insert all slots then shifts
  if (slotInserts.length > 0) {
    const { error: slotError } = await supabase.from('shift_slots').insert(slotInserts)
    if (slotError) return { success: false, error: slotError.message }
  }

  if (shiftInserts.length > 0) {
    const { error: shiftError } = await supabase.from('shifts').insert(shiftInserts)
    if (shiftError) return { success: false, error: shiftError.message }
  }

  // Pre-fill fixed shifts for staff with shift_pattern_preference = 'fixed'
  let preFillCount = 0
  const { data: fixedStaff } = await supabase
    .from('staff_fixed_shifts')
    .select('staff_id, day_of_week, shift_template_id, effective_from, effective_to')
    .eq('home_id', homeId)

  if (fixedStaff && fixedStaff.length > 0) {
    for (const fx of fixedStaff) {
      if (fx.effective_to && new Date(fx.effective_to) < periodStart) continue
      if (new Date(fx.effective_from) > periodEnd) continue

      // Slots matching this fixed shift: same template AND same day of week. (The slot's
      // weekday is derived from its date; assumes a UTC runtime, consistent with slot creation.)
      const targetSlotIds = slotInserts
        .filter((s: unknown) => {
          const slot = s as { id: string; date: string; shift_pattern_template_id?: string }
          if (slot.shift_pattern_template_id !== fx.shift_template_id) return false
          return new Date(`${slot.date}T00:00:00Z`).getUTCDay() === fx.day_of_week
        })
        .map((s: unknown) => (s as { id: string }).id)

      if (targetSlotIds.length === 0) continue

      // Find an unassigned shift on one of those slots
      const { data: matchingShifts } = await supabase
        .from('shifts')
        .select('id, shift_slot_id')
        .eq('home_id', homeId)
        .is('staff_id', null)
        .eq('state', 'unassigned')
        .in('shift_slot_id', targetSlotIds)
        .limit(1)

      if (matchingShifts && matchingShifts[0]) {
        await supabase
          .from('shifts')
          .update({ staff_id: fx.staff_id, state: 'assigned', updated_by_user_id: userId })
          .eq('id', matchingShifts[0].id)
        preFillCount++
      }
    }
  }

  return {
    success: true,
    periodId,
    slotsCreated: slotInserts.length,
    shiftsPreFilled: preFillCount,
  }
}
