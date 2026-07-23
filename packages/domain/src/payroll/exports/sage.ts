import type { CsvFile, PayRunExportInput } from './types'
import { buildCsv, penceToGbp } from './csv-builder'

// Sage 50 Payroll CSV import format
const HEADERS = [
  'Employee Reference', 'Title', 'Forename', 'Surname',
  'NI Number', 'Tax Code', 'NI Letter',
  'Pay Period Start', 'Pay Period End', 'Payment Date',
  'Basic Pay Hours', 'Basic Pay Rate', 'Basic Pay Amount',
  'Overtime Hours', 'Overtime Rate', 'Overtime Amount',
  'Holiday Pay Amount', 'SSP Amount', 'SMP Amount', 'SPP Amount',
  'Other Additions',
  'Employee NI', 'Employer NI',
  'Employee Pension', 'Employer Pension',
  'PAYE Tax',
  'Student Loan Deductions',
  'Net Pay',
]

export function exportSage(input: PayRunExportInput): CsvFile {
  const rows = input.rows.map(r => {
    const basicPayHours = ((r.grossWeekday + r.grossWeekend + r.grossBankHoliday +
                            r.grossChristmas + r.grossNight) / Math.max(r.rateWeekday, 1) * 60)
    const otherAdditions = r.grossTraining + r.grossSleepInTotal + r.contractualSickAmount

    return [
      r.employeeNumber, '', r.firstName, r.lastName,
      r.niNumber, r.taxCode, r.niCategory,
      r.periodStart, r.periodEnd, r.payDay,
      penceToGbp(basicPayHours * 60),       // hours
      penceToGbp(r.rateWeekday),             // rate
      penceToGbp(r.grossWeekday + r.grossWeekend + r.grossBankHoliday + r.grossChristmas + r.grossNight),
      penceToGbp(r.hoursOvertime * 60),
      penceToGbp(r.rateOvertime),
      penceToGbp(r.grossOvertime),
      penceToGbp(r.grossHoliday),
      penceToGbp(r.sspAmount),
      '0.00',   // SMP — not populated in v1
      '0.00',   // SPP — not populated in v1
      penceToGbp(otherAdditions),
      penceToGbp(r.niEmployee),
      penceToGbp(r.niEmployer),
      penceToGbp(r.pensionEmployee),
      penceToGbp(r.pensionEmployer),
      penceToGbp(r.payeTax),
      penceToGbp(r.studentLoan),
      penceToGbp(r.netPay),
    ]
  })

  return {
    filename: `payroll-sage-${input.payRunId}.csv`,
    content: buildCsv(HEADERS, rows),
    format: 'sage',
  }
}
