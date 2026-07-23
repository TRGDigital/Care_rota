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

    // A NULL day_of_week means "every day"; otherwise it must match this weekday.
    const dayReqs = (requirements ?? []).filter(r => r.day_of_week === null || r.day_of_week === dayOfWeek)

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

  // ── Fixed schedules → shifts ──────────────────────────────────────────────────
  // Place each staff member's fixed weekly pattern onto the rota. If a matching standard-week
  // slot exists, assign them to it; otherwise create the slot + assigned shift directly. So
  // allocating a pattern to a staff member (e.g. a night shift) is enough on its own — it does
  // NOT also have to be added to the standard week.
  let preFillCount = 0
  const { data: fixedStaff } = await supabase
    .from('staff_fixed_shifts')
    .select('staff_id, day_of_week, shift_template_id, effective_from, effective_to')
    .eq('home_id', homeId)

  if (fixedStaff && fixedStaff.length > 0) {
    const fxTemplateIds = [...new Set(fixedStaff.map((f: { shift_template_id: string }) => f.shift_template_id))]
    const { data: fxTemplates } = await supabase
      .from('shift_pattern_templates')
      .select('id, start_time_local, end_time_local, break_minutes, paid_hours_decimal')
      .in('id', fxTemplateIds)
    const fxTmplMap = new Map((fxTemplates ?? []).map((t: { id: string }) => [t.id, t]))

    const fxStaffIds = [...new Set(fixedStaff.map((f: { staff_id: string }) => f.staff_id))]
    const { data: fxStaffRows } = await supabase.from('staff').select('id, role_code, status').in('id', fxStaffIds)
    const roleByStaff = new Map((fxStaffRows ?? []).map((s: { id: string; role_code: string | null }) => [s.id, s.role_code ?? 'care_assistant']))
    // Only active staff get their fixed schedule placed — long-term sick, on leave, or left staff
    // must not appear on the rota.
    const activeStaff = new Set((fxStaffRows ?? []).filter((s: { status: string }) => s.status === 'active').map((s: { id: string }) => s.id))

    for (const fx of fixedStaff) {
      if (!activeStaff.has(fx.staff_id)) continue
      if (fx.effective_to && new Date(fx.effective_to) < periodStart) continue
      if (new Date(fx.effective_from) > periodEnd) continue
      const tmpl = fxTmplMap.get(fx.shift_template_id) as { start_time_local: string; end_time_local: string; break_minutes: number; paid_hours_decimal: number } | undefined
      if (!tmpl) continue

      // Every matching weekday in the period (supports multi-week periods).
      const dayCursor = new Date(periodStart)
      while (dayCursor <= periodEnd) {
        if (dayCursor.getUTCDay() === fx.day_of_week) {
          const dateStr = dayCursor.toISOString().split('T')[0]!
          const [sH, sM] = tmpl.start_time_local.split(':').map(Number)
          const [eH, eM] = tmpl.end_time_local.split(':').map(Number)
          const st = new Date(`${dateStr}T${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}:00`)
          const en = new Date(`${dateStr}T${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}:00`)
          if (en <= st) en.setDate(en.getDate() + 1) // overnight

          // Reuse an existing unassigned standard-week slot for this date + template if there is one.
          const { data: match } = await supabase
            .from('shifts')
            .select('id, shift_slots!inner(date, shift_pattern_template_id)')
            .eq('home_id', homeId)
            .is('staff_id', null)
            .eq('state', 'unassigned')
            .eq('shift_slots.date', dateStr)
            .eq('shift_slots.shift_pattern_template_id', fx.shift_template_id)
            .limit(1)

          if (match && match[0]) {
            await supabase.from('shifts').update({ staff_id: fx.staff_id, state: 'assigned', updated_by_user_id: userId }).eq('id', match[0].id)
          } else {
            const newSlotId = crypto.randomUUID()
            await supabase.from('shift_slots').insert({
              id: newSlotId, home_id: homeId, tenant_id: homeId, rota_period_id: periodId,
              date: dateStr, shift_pattern_template_id: fx.shift_template_id,
              role_code: roleByStaff.get(fx.staff_id) ?? 'care_assistant', headcount_required: 1, created_by_user_id: userId,
            })
            await supabase.from('shifts').insert({
              home_id: homeId, tenant_id: homeId, shift_slot_id: newSlotId, staff_id: fx.staff_id, state: 'assigned',
              planned_start_utc: st.toISOString(), planned_end_utc: en.toISOString(),
              planned_break_minutes: tmpl.break_minutes, planned_paid_hours: tmpl.paid_hours_decimal, created_by_user_id: userId,
            })
          }
          preFillCount++
        }
        dayCursor.setDate(dayCursor.getDate() + 1)
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
