// Reconciliation worker — runs every 5 minutes via pg_cron or Supabase scheduled function.
// Resolves shift clockings against planned shifts and writes shifts_actual + shifts_payable.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { reconcileShift } from 'https://esm.sh/@carerota/domain@*'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async () => {
  const now = new Date()

  // Fetch all shifts in published periods whose window may have closed:
  // planned_end + 2h in the past (give the no-clock-out hold time to expire)
  const cutoff = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()

  const { data: shifts, error: shiftErr } = await supabase
    .from('shifts')
    .select(`
      id, staff_id, planned_start_utc, planned_end_utc, is_sleep_in,
      shift_pattern_template_id,
      shift_pattern_templates!inner ( break_minutes ),
      rota_periods!inner ( state, home_id, tenant_id )
    `)
    .eq('rota_periods.state', 'published')
    .lt('planned_end_utc', cutoff)
    .not('staff_id', 'is', null)

  if (shiftErr) {
    console.error('shift query failed', shiftErr)
    return new Response(JSON.stringify({ error: shiftErr.message }), { status: 500 })
  }

  let processed = 0
  let errors    = 0

  for (const shift of shifts ?? []) {
    try {
      const homeId   = (shift as any).rota_periods.home_id
      const tenantId = (shift as any).rota_periods.tenant_id
      const breakMins = (shift as any).shift_pattern_templates?.break_minutes ?? 0

      // Fetch clockings for this shift
      const { data: clockings } = await supabase
        .from('shift_clockings')
        .select('id, event_type, event_time_utc')
        .eq('staff_id', shift.staff_id)
        .eq('home_id', homeId)
        .gte('event_time_utc', shift.planned_start_utc)
        .lte('event_time_utc', new Date(new Date(shift.planned_end_utc).getTime() + 4 * 60 * 60 * 1000).toISOString())

      // Fetch home-specific grace windows
      const { data: home } = await supabase
        .from('homes')
        .select('no_show_grace_minutes, no_clock_out_hold_minutes, bank_holiday_region')
        .eq('id', homeId)
        .single()

      // Determine bank holiday (simplified: check premium_pay_calendar)
      const { data: bankHolidayRow } = await supabase
        .from('premium_pay_calendar')
        .select('id')
        .eq('home_id', homeId)
        .eq('calendar_date', shift.planned_start_utc.substring(0, 10))
        .single()

      const isBankHoliday = !!bankHolidayRow

      const result = reconcileShift({
        shift: {
          id:                   shift.id,
          staff_id:             shift.staff_id!,
          planned_start_utc:    shift.planned_start_utc,
          planned_end_utc:      shift.planned_end_utc,
          planned_break_minutes: breakMins,
          is_sleep_in:          shift.is_sleep_in ?? false,
        },
        clockings: (clockings ?? []).map(c => ({
          id:             c.id,
          event_type:     c.event_type as any,
          event_time_utc: c.event_time_utc,
        })),
        isBankHoliday,
        noShowGraceMinutes:    home?.no_show_grace_minutes    ?? 30,
        noClockOutHoldMinutes: home?.no_clock_out_hold_minutes ?? 90,
        nowUtc: now,
      })

      // Upsert shifts_actual
      const { data: actualRow, error: actualErr } = await supabase
        .from('shifts_actual')
        .upsert({
          tenant_id:            tenantId,
          home_id:              homeId,
          shift_id:             shift.id,
          staff_id:             shift.staff_id,
          reconciliation_status: result.reconciliation_state,
          actual_start_utc:     result.actual_start_utc,
          actual_end_utc:       result.actual_end_utc,
          actual_worked_minutes: result.actual_worked_minutes,
          actual_break_minutes:  result.actual_break_minutes,
          disturbed_minutes:     result.disturbed_minutes,
          clockings_count:       result.clockings_count,
          last_reconciled_at:    now.toISOString(),
          updated_at:            now.toISOString(),
        }, { onConflict: 'shift_id' })
        .select('id')
        .single()

      if (actualErr) throw actualErr

      // Only write shifts_payable if payable minutes are determined
      if (result.payable !== null) {
        await supabase
          .from('shifts_payable')
          .upsert({
            tenant_id:              tenantId,
            home_id:                homeId,
            shift_id:               shift.id,
            staff_id:               shift.staff_id,
            shifts_actual_id:       actualRow?.id,
            reconciliation_state:   result.reconciliation_state,
            paid_minutes_weekday:   result.payable.weekday,
            paid_minutes_weekend:   result.payable.weekend,
            paid_minutes_bank_holiday: result.payable.bank_holiday,
            paid_minutes_night:     result.payable.night,
            paid_minutes_sleep_in:  result.payable.sleep_in,
            paid_minutes_disturbed: result.payable.disturbed,
            source_rule:            result.source_rule,
            updated_at:             now.toISOString(),
          }, { onConflict: 'shift_id' })
      }

      processed++
    } catch (err) {
      console.error('reconcile error for shift', shift.id, err)
      errors++
    }
  }

  return new Response(
    JSON.stringify({ processed, errors, timestamp: now.toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
