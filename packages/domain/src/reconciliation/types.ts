export type ReconciliationState =
  | 'pending'
  | 'matched'
  | 'over_planned'
  | 'under_planned'
  | 'no_show'
  | 'no_clock_out'
  | 'manual_override'

export type PayableSourceRule =
  | 'auto_actual'
  | 'manager_override'
  | 'pay_zero_no_show'
  | 'pay_planned_override'

export type ClockingEvent = {
  id: string
  event_type: 'clock_in' | 'clock_out' | 'disturbed_start' | 'disturbed_end'
  event_time_utc: string  // ISO string
}

export type PlannedShift = {
  id: string
  staff_id: string
  planned_start_utc: string
  planned_end_utc: string
  /** break minutes from shift_pattern_template */
  planned_break_minutes: number
  is_sleep_in: boolean
}

export type ReconciliationResult = {
  reconciliation_state: ReconciliationState
  actual_start_utc: string | null
  actual_end_utc: string | null
  actual_worked_minutes: number | null
  actual_break_minutes: number
  disturbed_minutes: number
  clockings_count: number
  /** minutes per time category — null = held (no_clock_out) */
  payable: PayableMinutes | null
  source_rule: PayableSourceRule
}

export type PayableMinutes = {
  weekday: number
  weekend: number
  bank_holiday: number
  night: number
  sleep_in: number        // 1 = pay flat rate, 0 = no flat pay
  disturbed: number
}
