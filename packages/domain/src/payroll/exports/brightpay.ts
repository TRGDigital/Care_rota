import type { CsvFile, PayRunExportInput } from './types'
import { buildCsv, penceToGbp } from './csv-builder'

// BrightPay CSV import format (v2024)
// Columns per BrightPay's documented "Payroll Import" template
const HEADERS = [
  'Employee Ref', 'Forename', 'Surname', 'NI Number', 'Tax Code', 'NI Category',
  'Pay Frequency', 'Period Start', 'Period End', 'Payment Date',
  'Basic Pay', 'Overtime Pay', 'Holiday Pay', 'Sickness Pay', 'Other Pay',
  'Pension Employee', 'Pension Employer',
  'Tax', 'NI Employee', 'NI Employer',
  'Net Pay',
]

export function exportBrightPay(input: PayRunExportInput): CsvFile {
  const rows = input.rows.map(r => {
    const basicPay = r.grossWeekday + r.grossWeekend + r.grossBankHoliday +
                     r.grossChristmas + r.grossNight + r.grossSleepInTotal
    const otherPay = r.grossTraining + r.sspAmount + r.contractualSickAmount

    return [
      r.employeeNumber, r.firstName, r.lastName, r.niNumber, r.taxCode, r.niCategory,
      frequencyCode(r.weeksInPeriod),
      r.periodStart, r.periodEnd, r.payDay,
      penceToGbp(basicPay),
      penceToGbp(r.grossOvertime),
      penceToGbp(r.grossHoliday),
      penceToGbp(r.contractualSickAmount),
      penceToGbp(otherPay),
      penceToGbp(r.pensionEmployee),
      penceToGbp(r.pensionEmployer),
      penceToGbp(r.payeTax),
      penceToGbp(r.niEmployee),
      penceToGbp(r.niEmployer),
      penceToGbp(r.netPay),
    ]
  })

  return {
    filename: `payroll-brightpay-${input.payRunId}.csv`,
    content: buildCsv(HEADERS, rows),
    format: 'brightpay',
  }
}

function frequencyCode(weeks: number): string {
  if (weeks === 1) return 'W'
  if (weeks === 2) return 'F'
  if (weeks === 4) return 'Q'
  return 'M'
}
