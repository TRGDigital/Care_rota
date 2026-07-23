import type {
  PayrunInput, PayrunResult, PayslipResult, PayslipLine,
  ShiftPayable, StaffMember, StaffPayRate,
} from './types'
import { resolveRate, resolveNmwFloor, minutesToPence, roundHalfUp } from './rates'
import { checkNmwFloors } from './nmw'

// 2025/26 PAYE bands (annual, pence)
const PERSONAL_ALLOWANCE_PENCE = 1_257_000 // £12,570
const BASIC_RATE_THRESHOLD_PENCE = 5_027_000 // £50,270 (PA + basic rate band)
const HIGHER_RATE_THRESHOLD_PENCE = 12_570_000 // £125,700
const BASIC_RATE = 0.20
const HIGHER_RATE = 0.40
const ADDITIONAL_RATE = 0.45

// 2025/26 NI thresholds (weekly, pence) — Employee Cat A
const NI_LOWER_EARNINGS_LIMIT_WEEKLY_PENCE = 12300  // £123/week
const NI_PRIMARY_THRESHOLD_WEEKLY_PENCE = 24200    // £242/week
const NI_UPPER_EARNINGS_LIMIT_WEEKLY_PENCE = 96700  // £967/week
const NI_MAIN_RATE = 0.08
const NI_UPPER_RATE = 0.02
const NI_EMPLOYER_RATE = 0.138
const NI_EMPLOYER_SECONDARY_THRESHOLD_WEEKLY_PENCE = 17500 // £175/week

// SSP weekly rate 2025/26 (pence)
const SSP_WEEKLY_RATE_PENCE = 11606 // £116.06

export function calculatePayrun(input: PayrunInput): PayrunResult {
  const payslips: PayslipResult[] = []

  for (const member of input.staff) {
    const ps = calculatePayslip(member, input)
    payslips.push(ps)
  }

  const nmwBreaches = checkNmwFloors(
    payslips, input.staff, input.referenceWageRates, input.periodEndDate
  )

  const totalGrossPence = payslips.reduce((a, p) => a + p.grossTotalPence, 0n)
  const totalNetPence   = payslips.reduce((a, p) => a + p.netPayPence, 0n)
  const totalEmployerCostPence = payslips.reduce(
    (a, p) => a + p.grossTotalPence + p.niEmployerPence + p.pensionEmployerPence, 0n
  )

  return { payRunId: input.payRunId, payslips, totalGrossPence, totalNetPence, totalEmployerCostPence, nmwBreaches }
}

function calculatePayslip(member: StaffMember, input: PayrunInput): PayslipResult {
  const lines: PayslipLine[] = []

  // ── Step 1: aggregate shifts_payable by category ─────────────────────────

  type CategoryBucket = {
    weekday: number; weekend: number; bank_holiday: number; christmas: number
    night: number; overtime: number; sickness: number; sleep_in: number
    training: number; holiday: number
  }
  const buckets: CategoryBucket = {
    weekday: 0, weekend: 0, bank_holiday: 0, christmas: 0,
    night: 0, overtime: 0, sickness: 0, sleep_in: 0, training: 0, holiday: 0,
  }
  const sourceShiftIdsByCategory: Record<string, string[]> = {}

  const memberShifts = input.shiftPayables.filter(sp => sp.staff_id === member.id)

  for (const sp of memberShifts) {
    const rate = resolveRate(input.staffPayRates, member.id, sp.shift_date)
    if (!rate) continue

    buckets.weekday      += sp.paid_minutes_weekday
    buckets.weekend      += sp.paid_minutes_weekend
    buckets.bank_holiday += sp.paid_minutes_bank_holiday
    buckets.christmas    += sp.paid_minutes_christmas
    buckets.night        += sp.paid_minutes_night
    buckets.overtime     += sp.paid_minutes_overtime
    buckets.sickness     += sp.paid_minutes_sickness
    buckets.sleep_in     += sp.paid_minutes_sleep_in
    buckets.training     += sp.paid_minutes_training
    buckets.holiday      += sp.paid_minutes_holiday

    const categories: (keyof CategoryBucket)[] = [
      'weekday', 'weekend', 'bank_holiday', 'christmas', 'night', 'overtime', 'sickness', 'sleep_in', 'training', 'holiday',
    ]
    for (const cat of categories) {
      if (sp[`paid_minutes_${cat}`] > 0) {
        sourceShiftIdsByCategory[cat] ??= []
        sourceShiftIdsByCategory[cat].push(sp.shift_id)
      }
    }
  }

  // ── Step 2: build pay lines ───────────────────────────────────────────────
  // Resolve rate for the period end date (covers multi-rate periods)
  const rate = resolveRate(input.staffPayRates, member.id, input.periodEndDate)
  if (!rate) {
    return emptyPayslip(member.id)
  }

  function addLine(
    lineType: PayslipLine['lineType'],
    description: string,
    minutes: number,
    ratePencePerHour: number,
    multiplier: number,
    shiftIds?: string[]
  ) {
    if (minutes <= 0) return
    const amountPence = minutesToPence(minutes, ratePencePerHour, multiplier)
    lines.push({
      lineType, description,
      minutes, hours: minutes / 60,
      ratePence: ratePencePerHour, multiplier, amountPence,
      sourceShiftIds: shiftIds ?? [],
    })
  }

  const mult = (sp: ShiftPayable | undefined) => sp?.premium_multiplier_applied ?? 1

  addLine('basic_weekday', 'Weekday hours', buckets.weekday, rate.rate_weekday_pence, 1, sourceShiftIdsByCategory['weekday'])
  addLine('basic_weekend', 'Weekend hours', buckets.weekend, rate.rate_weekend_pence, 1, sourceShiftIdsByCategory['weekend'])
  addLine('bank_holiday', 'Bank holiday hours', buckets.bank_holiday, rate.rate_weekday_pence,
    memberShifts.find(s => s.paid_minutes_bank_holiday > 0)?.premium_multiplier_applied ?? 1.5,
    sourceShiftIdsByCategory['bank_holiday'])
  addLine('christmas', 'Christmas day hours', buckets.christmas, rate.rate_weekday_pence,
    memberShifts.find(s => s.paid_minutes_christmas > 0)?.premium_multiplier_applied ?? 2.0,
    sourceShiftIdsByCategory['christmas'])
  addLine('night', 'Night hours', buckets.night, rate.rate_night_pence, 1, sourceShiftIdsByCategory['night'])
  addLine('overtime', 'Overtime hours', buckets.overtime, rate.rate_overtime_pence, 1, sourceShiftIdsByCategory['overtime'])
  addLine('sickness', 'Sickness (contractual)', buckets.sickness, rate.rate_weekday_pence, 1, sourceShiftIdsByCategory['sickness'])
  addLine('sleep_in', 'Sleep-in allowance', buckets.sleep_in > 0 ? 1 : 0, rate.rate_sleep_in_flat_pence * 60, 1, sourceShiftIdsByCategory['sleep_in'])
  addLine('holiday', 'Annual leave', buckets.holiday, rate.rate_weekday_pence, 1, sourceShiftIdsByCategory['holiday'])

  // ── Step 3: training top-ups ──────────────────────────────────────────────
  const memberTraining = input.trainingAttendances.filter(
    t => t.staff_id === member.id && t.attended && t.minutes_outside_shift_payable > 0
  )
  const trainingMinutes = memberTraining.reduce((a, t) => a + t.minutes_outside_shift_payable, 0)
  if (trainingMinutes > 0) {
    const amountPence = minutesToPence(trainingMinutes, rate.rate_training_pence, 1)
    lines.push({
      lineType: 'training', description: 'Training top-up',
      minutes: trainingMinutes, hours: trainingMinutes / 60,
      ratePence: rate.rate_training_pence, multiplier: 1, amountPence,
      sourceShiftIds: [],
    })
  }

  // ── Step 4: statutory payments (SSP only in v1) ───────────────────────────
  const memberStatutory = input.statutoryPayments.filter(
    sp => sp.staff_id === member.id &&
    sp.period_start <= input.periodEndDate &&
    sp.period_end >= input.periodStartDate
  )
  let statutoryPaymentsPence = 0n
  for (const sp of memberStatutory) {
    const weeksPro = weeksOverlapping(sp, input.periodStartDate, input.periodEndDate, input.weeksInPeriod)
    const sspPence = roundHalfUp(sp.weekly_rate_pence * weeksPro)
    if (sspPence <= 0n) continue
    statutoryPaymentsPence += sspPence
    lines.push({
      lineType: 'statutory_ssp', description: 'Statutory Sick Pay',
      minutes: 0, hours: 0, ratePence: sp.weekly_rate_pence,
      multiplier: 1, amountPence: sspPence, sourceShiftIds: [],
    })
  }

  // ── Gross total ───────────────────────────────────────────────────────────
  const grossLines = lines.filter(l => !l.lineType.startsWith('statutory'))
  const grossTotalPence = grossLines.reduce((a, l) => a + l.amountPence, 0n) + statutoryPaymentsPence

  // ── Step 5: pension ───────────────────────────────────────────────────────
  const { settings } = input
  const qualifying = clampBigInt(
    grossTotalPence,
    BigInt(settings.pension_qualifying_earnings_lower_pence) * BigInt(input.weeksInPeriod) / 52n,
    BigInt(settings.pension_qualifying_earnings_upper_pence) * BigInt(input.weeksInPeriod) / 52n
  )
  const pensionEmployeePence = roundHalfUp(Number(qualifying) * settings.pension_employee_pct / 100)
  const pensionEmployerPence = roundHalfUp(Number(qualifying) * settings.pension_employer_pct / 100)

  if (pensionEmployeePence > 0n) {
    lines.push({ lineType: 'pension_employee', description: 'Pension (employee)', minutes: 0, hours: 0, ratePence: 0, multiplier: 1, amountPence: -pensionEmployeePence, sourceShiftIds: [] })
    lines.push({ lineType: 'pension_employer', description: 'Pension (employer)', minutes: 0, hours: 0, ratePence: 0, multiplier: 1, amountPence: -pensionEmployerPence, sourceShiftIds: [] })
  }

  // ── Step 6: PAYE tax ──────────────────────────────────────────────────────
  const taxCode = member.tax_code ?? '1257L'
  const ytdGross = input.ytdGrossByStaff[member.id] ?? 0n
  const payeTaxPence = calculatePaye(grossTotalPence, ytdGross, taxCode)
  if (payeTaxPence > 0n) {
    lines.push({ lineType: 'paye_tax', description: `PAYE tax (${taxCode})`, minutes: 0, hours: 0, ratePence: 0, multiplier: 1, amountPence: -payeTaxPence, sourceShiftIds: [] })
  }

  // ── Step 7: National Insurance ────────────────────────────────────────────
  const niCategory = member.ni_category ?? 'A'
  const { employee: niEmployeePence, employer: niEmployerPence } =
    calculateNi(grossTotalPence, input.weeksInPeriod, niCategory)
  if (niEmployeePence > 0n) {
    lines.push({ lineType: 'ni_employee', description: `NI employee (Cat ${niCategory})`, minutes: 0, hours: 0, ratePence: 0, multiplier: 1, amountPence: -niEmployeePence, sourceShiftIds: [] })
    lines.push({ lineType: 'ni_employer', description: `NI employer (Cat ${niCategory})`, minutes: 0, hours: 0, ratePence: 0, multiplier: 1, amountPence: -niEmployerPence, sourceShiftIds: [] })
  }

  // ── Step 8: student loan ──────────────────────────────────────────────────
  const studentLoanPence = calculateStudentLoan(grossTotalPence, member.student_loan_plan)
  if (studentLoanPence > 0n) {
    lines.push({ lineType: 'student_loan', description: 'Student loan', minutes: 0, hours: 0, ratePence: 0, multiplier: 1, amountPence: -studentLoanPence, sourceShiftIds: [] })
  }

  // ── Net pay ───────────────────────────────────────────────────────────────
  const netPayPence = grossTotalPence - pensionEmployeePence - payeTaxPence - niEmployeePence - studentLoanPence

  // Per-category gross aggregates for payslips row
  const grossWeekdayPence     = sumByType(lines, 'basic_weekday')
  const grossWeekendPence     = sumByType(lines, 'basic_weekend')
  const grossBankHolidayPence = sumByType(lines, 'bank_holiday')
  const grossChristmasPence   = sumByType(lines, 'christmas')
  const grossNightPence       = sumByType(lines, 'night')
  const grossOvertimePence    = sumByType(lines, 'overtime')
  const grossTrainingPence    = sumByType(lines, 'training') + minutesToPence(trainingMinutes, rate.rate_training_pence, 1)
  const grossHolidayPence     = sumByType(lines, 'holiday')
  const grossSicknessPence    = sumByType(lines, 'sickness')
  const grossSleepInPence     = sumByType(lines, 'sleep_in')

  const nmw = {
    staffId: member.id,
    effectiveHourlyPenceTimes60: 0n, // populated in checkNmwFloors
    floorPence: resolveNmwFloor(input.referenceWageRates, member.date_of_birth, input.periodEndDate),
    passes: true,
  }

  return {
    staffId: member.id, lines,
    grossWeekdayPence, grossWeekendPence, grossBankHolidayPence, grossChristmasPence,
    grossNightPence, grossOvertimePence, grossTrainingPence, grossHolidayPence,
    grossSicknessPence, grossSleepInPence,
    grossTotalPence, statutoryPaymentsPence,
    pensionEmployeePence, pensionEmployerPence,
    payeTaxPence, niEmployeePence, niEmployerPence, studentLoanPence,
    netPayPence, taxCode, niCategory,
    nmw,
  }
}

// ── PAYE calculation (cumulative basis, 2025/26 bands) ──────────────────────

function calculatePaye(grossPence: bigint, ytdGrossPence: bigint, taxCode: string): bigint {
  const personalAllowance = parseTaxCode(taxCode)
  const annualGross = Number(ytdGrossPence + grossPence)

  const taxableIncome = Math.max(0, annualGross - personalAllowance)
  const annualTax = computeBandedTax(taxableIncome)

  const ytdTaxableIncome = Math.max(0, Number(ytdGrossPence) - personalAllowance)
  const ytdTax = computeBandedTax(ytdTaxableIncome)

  return BigInt(Math.max(0, Math.round(annualTax - ytdTax)))
}

function parseTaxCode(code: string): number {
  // Strip suffix (L, M, N, T, etc.) and parse number
  const match = code.match(/^(\d+)/)
  if (!match || !match[1]) return PERSONAL_ALLOWANCE_PENCE
  return parseInt(match[1], 10) * 100 // tax code digit × 100 = pence
}

function computeBandedTax(taxableIncomePence: number): number {
  if (taxableIncomePence <= 0) return 0

  const basicBandPence = BASIC_RATE_THRESHOLD_PENCE - PERSONAL_ALLOWANCE_PENCE // £37,700
  const higherBandPence = HIGHER_RATE_THRESHOLD_PENCE - BASIC_RATE_THRESHOLD_PENCE // £75,430

  let tax = 0
  let remaining = taxableIncomePence

  const inBasic = Math.min(remaining, basicBandPence)
  tax += inBasic * BASIC_RATE
  remaining -= inBasic

  const inHigher = Math.min(remaining, higherBandPence)
  tax += inHigher * HIGHER_RATE
  remaining -= inHigher

  tax += remaining * ADDITIONAL_RATE

  return tax
}

// ── NI calculation (weekly thresholds × weeks) ──────────────────────────────

function calculateNi(
  grossPence: bigint,
  weeksInPeriod: number,
  category: string
): { employee: bigint; employer: bigint } {
  if (category === 'X' || category === 'M') {
    return { employee: 0n, employer: 0n }
  }

  const periodPt  = BigInt(NI_PRIMARY_THRESHOLD_WEEKLY_PENCE * weeksInPeriod)
  const periodUel = BigInt(NI_UPPER_EARNINGS_LIMIT_WEEKLY_PENCE * weeksInPeriod)
  const periodSt  = BigInt(NI_EMPLOYER_SECONDARY_THRESHOLD_WEEKLY_PENCE * weeksInPeriod)

  // Employee
  const abovePt  = clampBigInt(grossPence, periodPt, periodUel)
  const aboveUel = grossPence > periodUel ? grossPence - periodUel : 0n
  const employee = roundHalfUp(Number(abovePt) * NI_MAIN_RATE + Number(aboveUel) * NI_UPPER_RATE)

  // Employer
  const aboveSt  = grossPence > periodSt ? grossPence - periodSt : 0n
  const employer = roundHalfUp(Number(aboveSt) * NI_EMPLOYER_RATE)

  return { employee, employer }
}

// ── Student loan ─────────────────────────────────────────────────────────────

function calculateStudentLoan(grossPence: bigint, plan: string | null): bigint {
  if (!plan) return 0n
  // Plan 1: threshold £24,990/yr = £2,082.50/mo; 9% above threshold
  const annualThresholdPence = 2_499_000
  const annualGross = Number(grossPence) * 12 // approximate for period
  const above = Math.max(0, annualGross - annualThresholdPence)
  return roundHalfUp((above * 0.09) / 12)
}

// ── SSP pro-rata ─────────────────────────────────────────────────────────────

function weeksOverlapping(
  sp: { period_start: string; period_end: string },
  periodStart: string,
  periodEnd: string,
  weeksInPeriod: number
): number {
  const overlapStart = sp.period_start > periodStart ? sp.period_start : periodStart
  const overlapEnd   = sp.period_end < periodEnd ? sp.period_end : periodEnd
  const overlapDays  = Math.max(0,
    (Date.parse(overlapEnd) - Date.parse(overlapStart)) / 86_400_000
  )
  const totalDays = weeksInPeriod * 7
  return overlapDays / 7
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampBigInt(value: bigint, min: bigint, max: bigint): bigint {
  if (value <= min) return 0n
  return value > max ? max - min : value - min
}

function sumByType(lines: PayslipLine[], type: PayslipLine['lineType']): bigint {
  return lines.filter(l => l.lineType === type).reduce((a, l) => a + l.amountPence, 0n)
}

function emptyPayslip(staffId: string): PayslipResult {
  return {
    staffId, lines: [],
    grossWeekdayPence: 0n, grossWeekendPence: 0n, grossBankHolidayPence: 0n,
    grossChristmasPence: 0n, grossNightPence: 0n, grossOvertimePence: 0n,
    grossTrainingPence: 0n, grossHolidayPence: 0n, grossSicknessPence: 0n,
    grossSleepInPence: 0n, grossTotalPence: 0n, statutoryPaymentsPence: 0n,
    pensionEmployeePence: 0n, pensionEmployerPence: 0n, payeTaxPence: 0n,
    niEmployeePence: 0n, niEmployerPence: 0n, studentLoanPence: 0n,
    netPayPence: 0n, taxCode: '1257L', niCategory: 'A',
    nmw: { staffId, effectiveHourlyPenceTimes60: 0n, floorPence: 0, passes: true },
  }
}
