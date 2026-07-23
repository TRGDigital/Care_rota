import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { calculatePayrun } from '@carerota/domain'
import type {
  PayrunInput, StaffPayRate, ShiftPayable, TrainingAttendance, HomePayrollSettings,
} from '@carerota/domain'

type RouteParams = { params: Promise<{ homeId: string }> }

// POST — create pay run for a period and run the calculation pipeline
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { payPeriodId } = body as { payPeriodId: string }
  if (!payPeriodId) return NextResponse.json({ error: 'payPeriodId required' }, { status: 400 })

  const svc = createServiceClient()

  // Load pay period
  const { data: period, error: pErr } = await svc
    .from('pay_periods')
    .select('*')
    .eq('id', payPeriodId)
    .eq('home_id', homeId)
    .single()
  if (pErr || !period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })

  // Idempotency: check no existing run for this period
  const { data: existing } = await svc
    .from('pay_runs')
    .select('id, status')
    .eq('pay_period_id', payPeriodId)
    .neq('status', 'void')
    .limit(1)
    .single()
  if (existing) return NextResponse.json({ runId: existing.id, status: existing.status })

  // Insert draft pay run
  const { data: run, error: runErr } = await svc
    .from('pay_runs')
    .insert({
      home_id: homeId,
      tenant_id: period.tenant_id,
      pay_period_id: payPeriodId,
      status: 'draft',
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
    })
    .select('id')
    .single()
  if (runErr || !run) return NextResponse.json({ error: 'Failed to create pay run' }, { status: 500 })

  // Kick off calculation (fire-and-forget; client polls for status)
  runCalculation(svc, run.id, homeId, period, user.id).catch(console.error)

  return NextResponse.json({ runId: run.id, status: 'draft' }, { status: 201 })
}

async function runCalculation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  runId: string,
  homeId: string,
  period: { id: string; tenant_id: string; period_start_date: string; period_end_date: string; weeks_in_period: number; pay_day: string },
  userId: string
) {
  // Load all staff for home
  const { data: staffRows } = await svc
    .from('staff')
    .select('id, date_of_birth, ni_number, tax_code, ni_category, student_loan_plan')
    .eq('home_id', homeId)
    .eq('status', 'active')

  // Load contracts for contracted hours
  const { data: contracts } = await svc
    .from('staff_contracts')
    .select('staff_id, contracted_hours_per_week')
    .eq('home_id', homeId)

  const contractMap = Object.fromEntries(
    (contracts ?? []).map((c: { staff_id: string; contracted_hours_per_week: number }) => [c.staff_id, c.contracted_hours_per_week])
  )

  const staff = (staffRows ?? []).map((s: {
    id: string; date_of_birth: string | null; ni_number: string | null;
    tax_code: string | null; ni_category: string | null; student_loan_plan: string | null
  }) => ({
    id: s.id,
    date_of_birth: s.date_of_birth,
    contracted_hours_per_week: contractMap[s.id] ?? 0,
    ni_number: s.ni_number,
    tax_code: s.tax_code,
    ni_category: s.ni_category,
    student_loan_plan: s.student_loan_plan,
    pension_opt_out: false,
  }))

  if (staff.length === 0) return

  // Load shifts_payable for the period
  const { data: shiftPayables } = await svc
    .from('shifts_payable')
    .select('*')
    .eq('home_id', homeId)
    .gte('shift_date', period.period_start_date)
    .lte('shift_date', period.period_end_date)

  // Load pay rates
  const { data: payRates } = await svc
    .from('staff_pay_rates')
    .select('*')
    .eq('home_id', homeId)

  // Load training attendances
  const { data: training } = await svc
    .from('staff_training_attendances')
    .select('id, staff_id, session_start_utc, session_end_utc, attended, minutes_overlapping_shift, minutes_outside_shift_payable, paid_status')
    .eq('home_id', homeId)
    .eq('attended', true)
    .gte('session_start_utc', period.period_start_date)
    .lte('session_start_utc', period.period_end_date)

  // Load statutory payments
  const { data: statutory } = await svc
    .from('statutory_payment_records')
    .select('*')
    .eq('home_id', homeId)
    .lte('period_start', period.period_end_date)
    .gte('period_end', period.period_start_date)

  // Load NMW reference rates
  const { data: refRates } = await svc
    .from('reference_wage_rates')
    .select('*')

  // Load home payroll settings from homes table (pension defaults)
  const settings: HomePayrollSettings = {
    pension_employee_pct: 5,
    pension_employer_pct: 3,
    pension_qualifying_earnings_lower_pence: 672000,
    pension_qualifying_earnings_upper_pence: 5002000,
    overtime_fill_order: ['basic_weekday', 'basic_weekend', 'bank_holiday', 'christmas'],
  }

  // Compute YTD gross for each staff member (for cumulative PAYE)
  const taxYearStart = taxYearStartForDate(period.period_start_date)
  const { data: ytdPayslips } = await svc
    .from('payslips')
    .select('staff_id, gross_total_pence')
    .eq('home_id', homeId)
    .neq('pay_run_id', runId)

  const ytdGrossByStaff: Record<string, bigint> = {}
  for (const ps of ytdPayslips ?? []) {
    ytdGrossByStaff[ps.staff_id] = (ytdGrossByStaff[ps.staff_id] ?? 0n) + BigInt(ps.gross_total_pence)
  }

  const input: PayrunInput = {
    payRunId: runId,
    homeId,
    tenantId: period.tenant_id,
    periodStartDate: period.period_start_date,
    periodEndDate: period.period_end_date,
    payDay: period.pay_day,
    weeksInPeriod: period.weeks_in_period,
    staff,
    shiftPayables: (shiftPayables ?? []) as ShiftPayable[],
    trainingAttendances: (training ?? []) as TrainingAttendance[],
    staffPayRates: (payRates ?? []) as StaffPayRate[],
    statutoryPayments: statutory ?? [],
    referenceWageRates: refRates ?? [],
    settings,
    taxYearStartDate: taxYearStart,
    ytdGrossByStaff,
  }

  const result = calculatePayrun(input)

  // Upsert payslips and lines
  for (const ps of result.payslips) {
    const { data: payslipRow } = await svc
      .from('payslips')
      .upsert({
        pay_run_id: runId,
        home_id: homeId,
        tenant_id: period.tenant_id,
        staff_id: ps.staffId,
        gross_weekday_pence: Number(ps.grossWeekdayPence),
        gross_weekend_pence: Number(ps.grossWeekendPence),
        gross_bank_holiday_pence: Number(ps.grossBankHolidayPence),
        gross_christmas_pence: Number(ps.grossChristmasPence),
        gross_night_pence: Number(ps.grossNightPence),
        gross_overtime_pence: Number(ps.grossOvertimePence),
        gross_training_pence: Number(ps.grossTrainingPence),
        gross_holiday_pence: Number(ps.grossHolidayPence),
        gross_sickness_pence: Number(ps.grossSicknessPence),
        gross_sleep_in_pence: Number(ps.grossSleepInPence),
        gross_total_pence: Number(ps.grossTotalPence),
        statutory_payments_pence: Number(ps.statutoryPaymentsPence),
        pension_employee_pence: Number(ps.pensionEmployeePence),
        pension_employer_pence: Number(ps.pensionEmployerPence),
        paye_tax_pence: Number(ps.payeTaxPence),
        ni_employee_pence: Number(ps.niEmployeePence),
        ni_employer_pence: Number(ps.niEmployerPence),
        student_loan_pence: Number(ps.studentLoanPence),
        net_pay_pence: Number(ps.netPayPence),
        tax_code: ps.taxCode,
        ni_category: ps.niCategory,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      }, { onConflict: 'pay_run_id,staff_id' })
      .select('id')
      .single()

    if (!payslipRow) continue

    // Replace payslip lines
    await svc.from('payslip_lines').delete().eq('payslip_id', payslipRow.id)
    const lineInserts = ps.lines
      .filter(l => l.amountPence !== 0n)
      .map(l => ({
        payslip_id: payslipRow.id,
        home_id: homeId,
        tenant_id: period.tenant_id,
        line_type: l.lineType,
        description: l.description,
        hours: l.hours,
        rate_pence: l.ratePence,
        multiplier: l.multiplier,
        amount_pence: Number(l.amountPence),
        source_shift_ids: l.sourceShiftIds,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      }))
    if (lineInserts.length > 0) {
      await svc.from('payslip_lines').insert(lineInserts)
    }
  }

  // Mark pay run as in_review
  await svc.from('pay_runs').update({
    status: 'in_review',
    submitted_for_review_at: new Date().toISOString(),
    submitted_by_user_id: userId,
    updated_by_user_id: userId,
  }).eq('id', runId)

  // Audit
  await svc.from('audit_events').insert({
    home_id: homeId,
    tenant_id: period.tenant_id,
    actor_user_id: userId,
    action_code: 'pay_run_calculated',
    entity_type: 'pay_run',
    entity_id: runId,
    after_state_json: {
      status: 'in_review',
      payslip_count: result.payslips.length,
      nmw_breach_count: result.nmwBreaches.filter(n => !n.passes).length,
    },
  })
}

function taxYearStartForDate(date: string): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const aprilSixth = new Date(year, 3, 6)
  return d >= aprilSixth ? `${year}-04-06` : `${year - 1}-04-06`
}
