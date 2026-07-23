// ─── Inputs ──────────────────────────────────────────────────────────────────

export type PayFrequency = 'weekly' | 'bi_weekly' | 'four_weekly' | 'monthly'

export type PayRunState = 'draft' | 'in_review' | 'approved' | 'exported' | 'locked'

export type PayslipLineType =
  | 'basic_weekday' | 'basic_weekend' | 'bank_holiday' | 'christmas'
  | 'night' | 'overtime' | 'training' | 'holiday' | 'sickness' | 'sleep_in'
  | 'statutory_ssp' | 'statutory_smp' | 'pension_employee' | 'pension_employer'
  | 'paye_tax' | 'ni_employee' | 'ni_employer' | 'student_loan'

export type TrainingPaidStatus = 'paid_top_up' | 'no_top_up' | 'partial'

export type StaffPayRate = {
  staff_id: string
  effective_from: string
  effective_to: string | null
  rate_weekday_pence: number
  rate_weekend_pence: number
  rate_night_pence: number
  rate_overtime_pence: number
  rate_training_pence: number
  rate_sleep_in_flat_pence: number
  role_code: string
}

export type ShiftPayable = {
  id: string
  shift_id: string
  staff_id: string
  home_id: string
  paid_minutes_weekday: number
  paid_minutes_weekend: number
  paid_minutes_bank_holiday: number
  paid_minutes_christmas: number
  paid_minutes_night: number
  paid_minutes_overtime: number
  paid_minutes_sickness: number
  paid_minutes_sleep_in: number
  paid_minutes_disturbed: number
  paid_minutes_training: number
  paid_minutes_holiday: number
  premium_multiplier_applied: number
  shift_date: string
  source_rule: string
}

export type TrainingAttendance = {
  id: string
  staff_id: string
  session_start_utc: string
  session_end_utc: string
  attended: boolean
  minutes_overlapping_shift: number
  minutes_outside_shift_payable: number
  paid_status: TrainingPaidStatus | 'skipped'
}

export type StatutoryPaymentRecord = {
  id: string
  staff_id: string
  payment_type: 'ssp' | 'smp' | 'spp' | 'sap' | 'shpp'
  period_start: string
  period_end: string
  total_pence: number
  weekly_rate_pence: number
}

export type StaffMember = {
  id: string
  date_of_birth: string | null
  contracted_hours_per_week: number
  ni_number: string | null
  tax_code: string | null
  ni_category: string | null
  student_loan_plan: string | null
  pension_opt_out: boolean
}

export type ReferenceWageRate = {
  age_band: string
  effective_from: string
  effective_to: string | null
  rate_pence: number
}

export type HomePayrollSettings = {
  pension_employee_pct: number
  pension_employer_pct: number
  pension_qualifying_earnings_lower_pence: number
  pension_qualifying_earnings_upper_pence: number
  overtime_fill_order: PayslipLineType[]
}

export type PayrunInput = {
  payRunId: string
  homeId: string
  tenantId: string
  periodStartDate: string
  periodEndDate: string
  payDay: string
  weeksInPeriod: number
  staff: StaffMember[]
  shiftPayables: ShiftPayable[]
  trainingAttendances: TrainingAttendance[]
  staffPayRates: StaffPayRate[]
  statutoryPayments: StatutoryPaymentRecord[]
  referenceWageRates: ReferenceWageRate[]
  settings: HomePayrollSettings
  taxYearStartDate: string
  ytdGrossByStaff: Record<string, bigint>
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

export type PayslipLine = {
  lineType: PayslipLineType
  description: string
  minutes: number
  hours: number
  ratePence: number
  multiplier: number
  amountPence: bigint
  sourceShiftIds: string[]
}

export type NmwCheckResult = {
  staffId: string
  effectiveHourlyPenceTimes60: bigint
  floorPence: number
  passes: boolean
}

export type PayslipResult = {
  staffId: string
  lines: PayslipLine[]
  grossWeekdayPence: bigint
  grossWeekendPence: bigint
  grossBankHolidayPence: bigint
  grossChristmasPence: bigint
  grossNightPence: bigint
  grossOvertimePence: bigint
  grossTrainingPence: bigint
  grossHolidayPence: bigint
  grossSicknessPence: bigint
  grossSleepInPence: bigint
  grossTotalPence: bigint
  statutoryPaymentsPence: bigint
  pensionEmployeePence: bigint
  pensionEmployerPence: bigint
  payeTaxPence: bigint
  niEmployeePence: bigint
  niEmployerPence: bigint
  studentLoanPence: bigint
  netPayPence: bigint
  taxCode: string
  niCategory: string
  nmw: NmwCheckResult
}

export type PayrunResult = {
  payRunId: string
  payslips: PayslipResult[]
  totalGrossPence: bigint
  totalNetPence: bigint
  totalEmployerCostPence: bigint
  nmwBreaches: NmwCheckResult[]
}
