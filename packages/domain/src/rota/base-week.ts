import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export type CaptureBaseWeekResult =
  | { success: true; patternsWritten: number }
  | { success: false; error: string }

/**
 * Capture the assignments of one worked-on week as the home's repeating base week. Every assigned
 * shift becomes a fixed weekly pattern (staff member → day of week → shift template), so future
 * periods regenerate the same people on the same shifts. Existing fixed patterns for the home are
 * replaced, making this week authoritative. Roll the base forward with generateHorizon; leave and
 * sickness are applied per-period at generation time (see createRotaPeriod), not baked into the base.
 */
export async function captureBaseWeek(
  supabase: AnyClient,
  homeId: string,
  periodId: string,
  userId: string
): Promise<CaptureBaseWeekResult> {
  const { data: period } = await supabase
    .from('rota_periods')
    .select('period_start_date')
    .eq('id', periodId)
    .eq('home_id', homeId)
    .single()
  if (!period) return { success: false, error: 'Period not found' }

  const { data: slots } = await supabase
    .from('shift_slots')
    .select('id, date, shift_pattern_template_id')
    .eq('rota_period_id', periodId)
  if (!slots?.length) return { success: false, error: 'This week has no shifts to capture.' }

  const slotById = new Map(
    slots.map((s: { id: string; date: string; shift_pattern_template_id: string }) => [s.id, s])
  )
  const slotIds = slots.map((s: { id: string }) => s.id)

  const { data: shifts } = await supabase
    .from('shifts')
    .select('staff_id, shift_slot_id, state')
    .in('shift_slot_id', slotIds)
    .eq('state', 'assigned')
    .not('staff_id', 'is', null)
  if (!shifts?.length) {
    return { success: false, error: 'No assigned shifts to capture — assign or auto-fill this week first.' }
  }

  // One fixed pattern per (staff, day-of-week, template). A carer on both a morning and an
  // afternoon block that day yields two rows (different templates), so full days are preserved.
  const seen = new Set<string>()
  const rows: object[] = []
  for (const sh of shifts as Array<{ staff_id: string; shift_slot_id: string }>) {
    const slot = slotById.get(sh.shift_slot_id) as { date: string; shift_pattern_template_id: string } | undefined
    if (!slot) continue
    const dow = new Date(`${slot.date}T00:00:00.000Z`).getUTCDay()
    const key = `${sh.staff_id}|${dow}|${slot.shift_pattern_template_id}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      home_id: homeId,
      tenant_id: homeId,
      staff_id: sh.staff_id,
      day_of_week: dow,
      shift_template_id: slot.shift_pattern_template_id,
      effective_from: period.period_start_date,
      created_by_user_id: userId,
    })
  }

  // Replace the home's fixed patterns with the captured base week.
  await supabase.from('staff_fixed_shifts').delete().eq('home_id', homeId)
  if (rows.length) {
    const { error } = await supabase.from('staff_fixed_shifts').insert(rows)
    if (error) return { success: false, error: error.message }
  }

  return { success: true, patternsWritten: rows.length }
}
