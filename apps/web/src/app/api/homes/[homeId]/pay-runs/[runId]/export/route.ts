import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { exportPayRun } from '@carerota/domain'
import type { PayRunExportInput, PayRunExportRow, ExportFormat } from '@carerota/domain'

type RouteParams = { params: Promise<{ homeId: string; runId: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { homeId, runId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const rawFormat = req.nextUrl.searchParams.get('format') ?? 'generic_csv'
  const format = (rawFormat === 'generic' ? 'generic_csv' : rawFormat) as Exclude<ExportFormat, 'generic'>
  const svc = createServiceClient()

  // Check for cached export (same run + format)
  const { data: existing } = await svc
    .from('payroll_exports')
    .select('id, file_url')
    .eq('pay_run_id', runId)
    .eq('format', format)
    .limit(1)
    .single()

  if (existing) {
    // Return the cached file URL for re-download
    return NextResponse.json({ url: existing.file_url, cached: true })
  }

  // Load pay run + period
  const { data: run } = await svc
    .from('pay_runs')
    .select('id, status, home_id, tenant_id, pay_periods!inner(period_start_date, period_end_date, pay_day, weeks_in_period)')
    .eq('id', runId)
    .eq('home_id', homeId)
    .single()
  if (!run || (run.status !== 'approved' && run.status !== 'exported')) {
    return NextResponse.json({ error: 'Pay run must be approved before export' }, { status: 409 })
  }

  const period = run.pay_periods as {
    period_start_date: string; period_end_date: string; pay_day: string; weeks_in_period: number
  } | null
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 500 })

  // Load home name
  const { data: home } = await svc.from('homes').select('name').eq('id', homeId).single()

  // Load payslips + lines + staff
  const { data: payslips } = await svc
    .from('payslips')
    .select(`
      id, staff_id, gross_total_pence, gross_weekday_pence, gross_weekend_pence,
      gross_bank_holiday_pence, gross_christmas_pence, gross_night_pence, gross_overtime_pence,
      gross_training_pence, gross_holiday_pence, gross_sickness_pence, gross_sleep_in_pence,
      statutory_payments_pence, pension_employee_pence, pension_employer_pence,
      paye_tax_pence, ni_employee_pence, ni_employer_pence, student_loan_pence, net_pay_pence,
      tax_code, ni_category
    `)
    .eq('pay_run_id', runId)

  const staffIds = payslips?.map(p => p.staff_id) ?? []
  const { data: staffRows } = await svc
    .from('staff')
    .select('id, first_name, last_name, ni_number, employee_number')
    .in('id', staffIds)

  const { data: linesAll } = await svc
    .from('payslip_lines')
    .select('payslip_id, line_type, hours, rate_pence, multiplier, amount_pence')
    .in('payslip_id', payslips?.map(p => p.id) ?? [])

  const staffMap = Object.fromEntries((staffRows ?? []).map(s => [s.id, s]))
  const linesByPayslip: Record<string, typeof linesAll> = {}
  for (const l of linesAll ?? []) {
    linesByPayslip[l.payslip_id] ??= []
    linesByPayslip[l.payslip_id]!.push(l)
  }

  const rows: PayRunExportRow[] = (payslips ?? []).map(ps => {
    const s = staffMap[ps.staff_id]
    const lines = linesByPayslip[ps.id] ?? []

    const lineHours = (type: string) => lines.find(l => l.line_type === type)?.hours ?? 0
    const lineRate  = (type: string) => lines.find(l => l.line_type === type)?.rate_pence ?? 0
    const lineMult  = (type: string) => lines.find(l => l.line_type === type)?.multiplier ?? 1

    return {
      employeeNumber:      s?.employee_number ?? ps.staff_id.slice(0, 8),
      firstName:           s?.first_name ?? '',
      lastName:            s?.last_name ?? '',
      niNumber:            s?.ni_number ?? '',
      taxCode:             ps.tax_code ?? '1257L',
      niCategory:          ps.ni_category ?? 'A',
      periodStart:         period.period_start_date,
      periodEnd:           period.period_end_date,
      payDay:              period.pay_day,
      weeksInPeriod:       period.weeks_in_period,
      hoursWeekday:        lineHours('basic_weekday'),
      rateWeekday:         lineRate('basic_weekday'),
      grossWeekday:        ps.gross_weekday_pence,
      hoursWeekend:        lineHours('basic_weekend'),
      rateWeekend:         lineRate('basic_weekend'),
      grossWeekend:        ps.gross_weekend_pence,
      hoursBankHoliday:    lineHours('bank_holiday'),
      rateBankHoliday:     lineRate('bank_holiday'),
      multiplierBankHoliday: lineMult('bank_holiday'),
      grossBankHoliday:    ps.gross_bank_holiday_pence,
      hoursChristmas:      lineHours('christmas'),
      rateChristmas:       lineRate('christmas'),
      multiplierChristmas: lineMult('christmas'),
      grossChristmas:      ps.gross_christmas_pence,
      hoursNight:          lineHours('night'),
      rateNight:           lineRate('night'),
      grossNight:          ps.gross_night_pence,
      hoursOvertime:       lineHours('overtime'),
      rateOvertime:        lineRate('overtime'),
      grossOvertime:       ps.gross_overtime_pence,
      hoursTraining:       lineHours('training'),
      rateTraining:        lineRate('training'),
      grossTraining:       ps.gross_training_pence,
      hoursHoliday:        lineHours('holiday'),
      rateHoliday:         lineRate('holiday'),
      grossHoliday:        ps.gross_holiday_pence,
      hoursSickness:       lineHours('sickness'),
      sspAmount:           (lines.find(l => l.line_type === 'statutory_ssp')?.amount_pence ?? 0),
      contractualSickAmount: ps.gross_sickness_pence,
      sleepInCount:        lineHours('sleep_in') > 0 ? 1 : 0,
      sleepInFlatRate:     lineRate('sleep_in'),
      hoursDisturbed:      0,
      grossSleepInTotal:   ps.gross_sleep_in_pence,
      grossTotal:          ps.gross_total_pence,
      pensionEmployee:     ps.pension_employee_pence,
      pensionEmployer:     ps.pension_employer_pence,
      payeTax:             ps.paye_tax_pence,
      niEmployee:          ps.ni_employee_pence,
      niEmployer:          ps.ni_employer_pence,
      studentLoan:         ps.student_loan_pence,
      netPay:              ps.net_pay_pence,
    }
  })

  const input: PayRunExportInput = {
    payRunId: runId,
    homeName: home?.name ?? '',
    format,
    rows,
  }

  const csv = exportPayRun(input)

  // Upload to Supabase Storage
  const storagePath = `payroll-exports/${homeId}/${runId}/${csv.filename}`
  const { data: upload } = await svc.storage
    .from('payroll')
    .upload(storagePath, Buffer.from(csv.content, 'utf-8'), {
      contentType: 'text/csv',
      upsert: false,
    })

  const { data: { publicUrl } } = svc.storage.from('payroll').getPublicUrl(storagePath)

  // Record export
  await svc.from('payroll_exports').insert({
    pay_run_id: runId,
    home_id: homeId,
    tenant_id: run.tenant_id,
    format,
    file_url: publicUrl,
    generated_at: new Date().toISOString(),
    generated_by_user_id: user.id,
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  })

  // Transition to exported if not already
  if (run.status === 'approved') {
    await svc.from('pay_runs').update({ status: 'exported', updated_by_user_id: user.id }).eq('id', runId)
    await svc.from('audit_events').insert({
      home_id: homeId,
      tenant_id: run.tenant_id,
      actor_user_id: user.id,
      action_code: 'pay_run_exported',
      entity_type: 'pay_run',
      entity_id: runId,
      after_state_json: { status: 'exported', format },
    })
  }

  return NextResponse.json({ url: publicUrl, filename: csv.filename, cached: false })
}
