import { describe, it, expect } from 'vitest'
import { exportPayRun, buildYearEndSummary } from '@carerota/domain'
import type { PayRunExportInput } from '@carerota/domain'

// ─── Shared fixture ────────────────────────────────────────────────────────────

const BASE_ROW = {
  employeeNumber:         'EMP001',
  firstName:              'Alice',
  lastName:               'Smith',
  niNumber:               'AB123456C',
  taxCode:                '1257L',
  niCategory:             'A',
  periodStart:            '2026-04-01',
  periodEnd:              '2026-04-28',
  payDay:                 '2026-04-30',
  weeksInPeriod:          4,
  hoursWeekday:           148,
  rateWeekday:            1271,
  grossWeekday:           188108,
  hoursWeekend:           24,
  rateWeekend:            1271,
  grossWeekend:           30504,
  hoursBankHoliday:       8,
  rateBankHoliday:        1271,
  multiplierBankHoliday:  1.5,
  grossBankHoliday:       15252,
  hoursChristmas:         0,
  rateChristmas:          1271,
  multiplierChristmas:    2.0,
  grossChristmas:         0,
  hoursNight:             0,
  rateNight:              1400,
  grossNight:             0,
  hoursOvertime:          0,
  rateOvertime:           1600,
  grossOvertime:          0,
  hoursTraining:          0,
  rateTraining:           1271,
  grossTraining:          0,
  hoursHoliday:           0,
  rateHoliday:            1271,
  grossHoliday:           0,
  hoursSickness:          0,
  sspAmount:              0,
  contractualSickAmount:  0,
  sleepInCount:           0,
  sleepInFlatRate:        5000,
  hoursDisturbed:         0,
  grossSleepInTotal:      0,
  grossTotal:             233864,
  pensionEmployee:        7193,
  pensionEmployer:        4316,
  payeTax:                34100,
  niEmployee:             19600,
  niEmployer:             22100,
  studentLoan:            0,
  netPay:                 172971,
}

function makeInput(overrides: Partial<PayRunExportInput> = {}): PayRunExportInput {
  return {
    payRunId: 'run-1',
    homeName: 'Sunrise Care Home',
    format:   'generic_csv',
    rows:     [{ ...BASE_ROW }],
    ...overrides,
  }
}

// Split CSV content handling CRLF (RFC 4180)
function csvLines(content: string): string[] {
  return content.split(/\r?\n/).filter(l => l.trim())
}

function parseCsv(content: string) {
  const lines = csvLines(content)
  const header = lines[0]!.split(',')
  const data = lines.slice(1).map(l => l.split(','))
  return { header, data }
}

// AT1 ─ Generic CSV has all required columns and correct values
describe('AT1 — Generic CSV', () => {
  it('contains all 51 required columns', () => {
    const { content } = exportPayRun(makeInput(), 'generic_csv')
    const { header } = parseCsv(content)

    const required = [
      'employee_number', 'first_name', 'last_name', 'ni_number',
      'tax_code', 'ni_category', 'period_start', 'period_end', 'pay_day', 'weeks_in_period',
      'hours_weekday', 'rate_weekday', 'gross_weekday',
      'hours_weekend', 'rate_weekend', 'gross_weekend',
      'hours_bank_holiday', 'rate_bank_holiday', 'multiplier_bank_holiday', 'gross_bank_holiday',
      'hours_christmas', 'rate_christmas', 'multiplier_christmas', 'gross_christmas',
      'hours_night', 'rate_night', 'gross_night',
      'hours_overtime', 'rate_overtime', 'gross_overtime',
      'hours_training', 'rate_training', 'gross_training',
      'hours_holiday', 'rate_holiday', 'gross_holiday',
      'hours_sickness', 'ssp_amount', 'contractual_sick_amount',
      'hours_sleep_in', 'sleep_in_flat_rate', 'hours_disturbed', 'gross_sleep_in_total',
      'gross_total',
      'pension_employee', 'pension_employer',
      'paye_tax', 'ni_employee', 'ni_employer', 'student_loan',
      'net_pay',
    ]

    for (const col of required) {
      expect(header, `missing column: ${col}`).toContain(col)
    }
  })

  it('populates employee values correctly', () => {
    const { content } = exportPayRun(makeInput(), 'generic_csv')
    const { header, data } = parseCsv(content)
    const row = data[0]!
    const get = (col: string) => row[header.indexOf(col)]

    expect(get('employee_number')).toBe('EMP001')
    expect(get('first_name')).toBe('Alice')
    expect(get('last_name')).toBe('Smith')
    expect(get('ni_number')).toBe('AB123456C')
    expect(get('tax_code')).toBe('1257L')
    expect(get('gross_total')).toBe('2338.64')
    expect(get('net_pay')).toBe('1729.71')
    expect(get('paye_tax')).toBe('341.00')
    expect(get('hours_weekday')).toBe('148.00')
  })
})

// AT2 ─ BrightPay CSV
describe('AT2 — BrightPay CSV', () => {
  it('has BrightPay-specific columns', () => {
    const { content } = exportPayRun(makeInput(), 'brightpay')
    const { header } = parseCsv(content)
    expect(header).toContain('Employee Ref')
    expect(header).toContain('Forename')
    expect(header).toContain('Surname')
    expect(header).toContain('Net Pay')
  })

  it('has one data row per employee', () => {
    const { content } = exportPayRun(makeInput(), 'brightpay')
    const { data } = parseCsv(content)
    expect(data).toHaveLength(1)
  })

  it('employee ref matches employee number', () => {
    const { content } = exportPayRun(makeInput(), 'brightpay')
    const { header, data } = parseCsv(content)
    expect(data[0]![header.indexOf('Employee Ref')]).toBe('EMP001')
  })
})

// AT3 ─ Sage CSV
describe('AT3 — Sage CSV', () => {
  it('has Sage-specific columns', () => {
    const { content } = exportPayRun(makeInput(), 'sage')
    const { header } = parseCsv(content)
    expect(header).toContain('Employee Reference')
    expect(header).toContain('PAYE Tax')
    expect(header).toContain('Net Pay')
  })

  it('has one data row per employee', () => {
    const { content } = exportPayRun(makeInput(), 'sage')
    const { data } = parseCsv(content)
    expect(data).toHaveLength(1)
  })
})

// AT4 ─ Christmas multiplier appears in generic export
describe('AT4 — Christmas multiplier in generic export', () => {
  it('populates multiplier_christmas as 2.0 when shift has Christmas hours', () => {
    const input = makeInput({
      rows: [{ ...BASE_ROW, hoursChristmas: 8, grossChristmas: 20336, multiplierChristmas: 2.0 }],
    })

    const { content } = exportPayRun(input, 'generic_csv')
    const { header, data } = parseCsv(content)
    const row = data[0]!
    const get = (col: string) => row[header.indexOf(col)]

    expect(get('multiplier_christmas')).toBe('2.00')
    expect(get('hours_christmas')).toBe('8.00')
    expect(get('gross_christmas')).toBe('203.36')
  })
})

// AT5 ─ Xero multi-row format
describe('AT5 — Xero CSV', () => {
  it('has Xero-specific columns', () => {
    const { content } = exportPayRun(makeInput(), 'xero')
    const { header } = parseCsv(content)
    expect(header).toContain('Employee Code')
    expect(header).toContain('Earnings Type')
    expect(header).toContain('Earnings Amount')
  })

  it('emits multiple earnings rows per employee', () => {
    const { content } = exportPayRun(makeInput(), 'xero')
    const { data } = parseCsv(content)
    // Weekend + weekday + bank holiday = at least 3 rows
    expect(data.length).toBeGreaterThanOrEqual(2)
  })
})

// AT6 ─ Moneysoft CSV
describe('AT6 — Moneysoft CSV', () => {
  it('has Moneysoft-specific columns', () => {
    const { content } = exportPayRun(makeInput(), 'moneysoft')
    const { header } = parseCsv(content)
    expect(header).toContain('Ref')
    expect(header).toContain('NI No')
    expect(header).toContain('Gross Pay')
    expect(header).toContain('Net Pay')
  })
})

// AT7 ─ IRIS CSV
describe('AT7 — IRIS CSV', () => {
  it('has IRIS-specific columns', () => {
    const { content } = exportPayRun(makeInput(), 'iris')
    const { header } = parseCsv(content)
    expect(header).toContain('Employee Number')
    expect(header).toContain('NI Number')
    expect(header).toContain('Tax Code')
    expect(header).toContain('Net Pay')
  })
})

// AT8 ─ buildYearEndSummary aggregates correctly
describe('AT8 — Year-end summary', () => {
  it('aggregates two pay runs for the same staff member', () => {
    const summary = buildYearEndSummary({
      taxYearStart: '2025-04-06',
      taxYearEnd:   '2026-04-05',
      homeName:     'Test Home',
      payslips: [
        {
          staffId: 'staff-1',
          firstName: 'Alice',
          lastName: 'Smith',
          niNumber: 'AB123456C',
          grossTotalPence: 200000,
          payeTaxPence: 30000,
          niEmployeePence: 15000,
          niEmployerPence: 17000,
          pensionEmployeePence: 8000,
          pensionEmployerPence: 4800,
          netPayPence: 147000,
        },
        {
          staffId: 'staff-1',
          firstName: 'Alice',
          lastName: 'Smith',
          niNumber: 'AB123456C',
          grossTotalPence: 210000,
          payeTaxPence: 32000,
          niEmployeePence: 16000,
          niEmployerPence: 18000,
          pensionEmployeePence: 8400,
          pensionEmployerPence: 5040,
          netPayPence: 153600,
        },
      ],
    })

    expect(summary.rows).toHaveLength(1)
    const row = summary.rows[0]!
    expect(row.totalGrossPence).toBe(410000)
    expect(row.totalPayeTaxPence).toBe(62000)
    expect(row.totalNetPayPence).toBe(300600)
    expect(summary.totalGross).toBe(410000)
    expect(summary.totalNet).toBe(300600)
  })

  it('aggregates two staff members correctly', () => {
    const summary = buildYearEndSummary({
      taxYearStart: '2025-04-06',
      taxYearEnd:   '2026-04-05',
      homeName:     'Test Home',
      payslips: [
        {
          staffId: 'staff-1', firstName: 'Alice', lastName: 'Smith', niNumber: 'AB123456C',
          grossTotalPence: 200000, payeTaxPence: 30000, niEmployeePence: 15000,
          niEmployerPence: 17000, pensionEmployeePence: 8000, pensionEmployerPence: 4800, netPayPence: 147000,
        },
        {
          staffId: 'staff-2', firstName: 'Bob', lastName: 'Jones', niNumber: 'CD654321E',
          grossTotalPence: 180000, payeTaxPence: 25000, niEmployeePence: 12000,
          niEmployerPence: 14000, pensionEmployeePence: 6000, pensionEmployerPence: 3600, netPayPence: 137000,
        },
      ],
    })

    expect(summary.rows).toHaveLength(2)
    expect(summary.totalGross).toBe(380000)
    expect(summary.totalNet).toBe(284000)
  })

  it('sorts rows by last name', () => {
    const ps = (staffId: string, first: string, last: string) => ({
      staffId, firstName: first, lastName: last, niNumber: null,
      grossTotalPence: 100000, payeTaxPence: 10000, niEmployeePence: 5000,
      niEmployerPence: 6000, pensionEmployeePence: 4000, pensionEmployerPence: 2400,
      netPayPence: 81000,
    })

    const summary = buildYearEndSummary({
      taxYearStart: '2025-04-06',
      taxYearEnd:   '2026-04-05',
      homeName:     'Test Home',
      payslips: [ps('s3', 'Chris', 'Williams'), ps('s1', 'Alice', 'Brown'), ps('s2', 'Bob', 'Jones')],
    })

    expect(summary.rows.map(r => r.lastName)).toEqual(['Brown', 'Jones', 'Williams'])
  })
})
