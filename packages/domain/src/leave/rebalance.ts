import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export type RebalanceTrigger =
  | 'leave_approved'
  | 'sickness_reported'
  | 'training_expired'
  | 'occupancy_drop'
  | 'occupancy_rise'
  | 'no_show'

export type RebalanceSuggestionResult =
  | { success: true; suggestionId: string | null } // null = no open published shifts affected
  | { success: false; error: string }

/**
 * Raises a rebalance_suggestions row if a trigger event affects published shifts.
 * Called after leave approval, sickness report, or training expiry events.
 */
export async function raiseRebalanceSuggestion(
  supabase: AnyClient,
  homeId: string,
  trigger: RebalanceTrigger,
  triggerEntityId: string,
  affectedStaffId: string,
  affectedDates: string[], // YYYY-MM-DD[]
  userId: string
): Promise<RebalanceSuggestionResult> {
  if (!affectedDates.length) return { success: true, suggestionId: null }

  // Find published shifts on the affected dates for this staff member
  const { data: publishedShifts } = await supabase
    .from('shifts')
    .select('id, planned_start_utc, planned_end_utc, shift_slot_id')
    .eq('home_id', homeId)
    .eq('staff_id', affectedStaffId)
    .eq('state', 'assigned')
    .in(
      'shift_slot_id',
      (
        await supabase
          .from('shift_slots')
          .select('id')
          .eq('home_id', homeId)
          .in('date', affectedDates)
          .in(
            'rota_period_id',
            (
              await supabase
                .from('rota_periods')
                .select('id')
                .eq('home_id', homeId)
                .eq('status', 'published')
            ).data?.map((p: { id: string }) => p.id) ?? []
          )
      ).data?.map((s: { id: string }) => s.id) ?? []
    )

  const affected = publishedShifts ?? []
  if (!affected.length) return { success: true, suggestionId: null }

  const shiftIds = affected.map((s: { id: string }) => s.id)
  const summary = buildSummary(trigger, affectedStaffId, affectedDates)

  const { data: suggestion, error } = await supabase
    .from('rebalance_suggestions')
    .insert({
      tenant_id: homeId,
      home_id: homeId,
      trigger_type: trigger,
      trigger_entity_id: triggerEntityId,
      status: 'open',
      summary,
      shift_ids_affected: shiftIds,
      proposed_changes: null,
      cost_impact_pence: 0,
      created_by_user_id: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  return { success: true, suggestionId: suggestion?.id ?? null }
}

function buildSummary(trigger: RebalanceTrigger, staffId: string, dates: string[]): string {
  const dateStr = dates.length === 1
    ? dates[0]!
    : `${dates[0]} – ${dates[dates.length - 1]}`

  switch (trigger) {
    case 'leave_approved': return `Leave approved for staff (${staffId.slice(0, 8)}…) on ${dateStr} — ${dates.length} published shift(s) need cover.`
    case 'sickness_reported': return `Sickness reported for staff (${staffId.slice(0, 8)}…) — ${dates.length} shift(s) in the next 48h need cover.`
    case 'training_expired': return `Training expired for staff (${staffId.slice(0, 8)}…) — ${dates.length} future shift(s) may be non-compliant.`
    default: return `Rebalance required: ${trigger} affecting ${dates.length} shift(s) from ${dateStr}.`
  }
}
