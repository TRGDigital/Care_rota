import type { CsvFile, PayRunExportInput } from './types'
import { buildCsv, penceToGbp } from './csv-builder'

// Xero Payroll (UK) CSV import format
const HEADERS = [
  'Employee Code', 'First Name', 'Last Name', 'Date Of Birth',
  'NI Number', 'Tax Code', 'NI Category',
  'Pay Run Period', 'Payment Date',
  'Earnings Type', 'Earnings Rate', 'Earnings Units', 'Earnings Amount',
  'Deduction Type', 'Deduction Amount',
  'Employer NI', 'Employer Pension',
]

export function exportXero(input: PayRunExportInput): CsvFile {
  const rows: (string | number | null)[][] = []

  for (const r of input.rows) {
    const period = `${r.periodStart} to ${r.periodEnd}`
    const baseRow = [r.employeeNumber, r.firstName, r.lastName, '', r.niNumber, r.taxCode, r.niCategory, period, r.payDay]

    // One earnings row per category (Xero uses separate rows per earnings type)
    if (r.grossWeekday > 0)     rows.push([...baseRow, 'Regular Hours',   penceToGbp(r.rateWeekday), penceToGbp(r.hoursWeekday*60), penceToGbp(r.grossWeekday), '', '', '', ''])
    if (r.grossWeekend > 0)     rows.push([...baseRow, 'Weekend',          penceToGbp(r.rateWeekend), penceToGbp(r.hoursWeekend*60), penceToGbp(r.grossWeekend), '', '', '', ''])
    if (r.grossBankHoliday > 0) rows.push([...baseRow, 'Bank Holiday',     penceToGbp(r.rateBankHoliday), penceToGbp(r.hoursBankHoliday*60), penceToGbp(r.grossBankHoliday), '', '', '', ''])
    if (r.grossChristmas > 0)   rows.push([...baseRow, 'Christmas Day',    penceToGbp(r.rateChristmas), penceToGbp(r.hoursChristmas*60), penceToGbp(r.grossChristmas), '', '', '', ''])
    if (r.grossOvertime > 0)    rows.push([...baseRow, 'Overtime',         penceToGbp(r.rateOvertime), penceToGbp(r.hoursOvertime*60), penceToGbp(r.grossOvertime), '', '', '', ''])
    if (r.grossHoliday > 0)     rows.push([...baseRow, 'Holiday Pay',      penceToGbp(r.rateHoliday), penceToGbp(r.hoursHoliday*60), penceToGbp(r.grossHoliday), '', '', '', ''])
    if (r.sspAmount > 0)        rows.push([...baseRow, 'SSP',              '0.00', '0.00', penceToGbp(r.sspAmount), '', '', '', ''])

    // Deductions row
    const totalDeductions = r.payeTax + r.niEmployee + r.pensionEmployee + r.studentLoan
    if (totalDeductions > 0)    rows.push([...baseRow, '', '', '', '', 'PAYE + NI + Pension', penceToGbp(totalDeductions), penceToGbp(r.niEmployer), penceToGbp(r.pensionEmployer)])
  }

  return {
    filename: `payroll-xero-${input.payRunId}.csv`,
    content: buildCsv(HEADERS, rows),
    format: 'xero',
  }
}
