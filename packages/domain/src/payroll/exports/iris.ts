import type { CsvFile, PayRunExportInput } from './types'
import { buildCsv, penceToGbp } from './csv-builder'

// IRIS Payroll Professional CSV import format
const HEADERS = [
  'Employee Number', 'Forename', 'Surname', 'NI Number', 'Tax Code', 'NI Table Letter',
  'Period Start Date', 'Period End Date', 'Pay Day',
  'Basic Hours', 'Basic Rate', 'Basic Amount',
  'Overtime Amount', 'Holiday Amount',
  'SSP', 'SMP', 'SPP', 'SAP',
  'Other Additions',
  'Gross',
  'Tax', 'EE NIC', 'ER NIC',
  'EE Pension', 'ER Pension',
  'Net Pay',
]

export function exportIris(input: PayRunExportInput): CsvFile {
  const rows = input.rows.map(r => {
    const basicPay = r.grossWeekday + r.grossWeekend + r.grossBankHoliday + r.grossChristmas + r.grossNight
    const basicHours = r.hoursWeekday + r.hoursWeekend + r.hoursBankHoliday + r.hoursChristmas
    const otherAdditions = r.grossTraining + r.grossSleepInTotal + r.contractualSickAmount

    return [
      r.employeeNumber, r.firstName, r.lastName, r.niNumber, r.taxCode, r.niCategory,
      r.periodStart, r.periodEnd, r.payDay,
      penceToGbp(basicHours * 60),
      penceToGbp(r.rateWeekday),
      penceToGbp(basicPay),
      penceToGbp(r.grossOvertime),
      penceToGbp(r.grossHoliday),
      penceToGbp(r.sspAmount),
      '0.00', '0.00', '0.00',  // SMP / SPP / SAP not populated in v1
      penceToGbp(otherAdditions),
      penceToGbp(r.grossTotal),
      penceToGbp(r.payeTax),
      penceToGbp(r.niEmployee),
      penceToGbp(r.niEmployer),
      penceToGbp(r.pensionEmployee),
      penceToGbp(r.pensionEmployer),
      penceToGbp(r.netPay),
    ]
  })

  return {
    filename: `payroll-iris-${input.payRunId}.csv`,
    content: buildCsv(HEADERS, rows),
    format: 'iris',
  }
}
