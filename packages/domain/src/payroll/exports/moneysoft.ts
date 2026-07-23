import type { CsvFile, PayRunExportInput } from './types'
import { buildCsv, penceToGbp } from './csv-builder'

// Moneysoft Payroll Manager CSV import format
const HEADERS = [
  'Ref', 'Surname', 'Forename', 'NI No', 'Tax Code', 'NI Cat',
  'Pay Period', 'Tax Period', 'Pay Date',
  'Normal Hours', 'Normal Rate', 'Normal Pay',
  'OT Hours', 'OT Rate', 'OT Pay',
  'Holiday', 'SSP', 'SMP', 'Other Pay',
  'Gross Pay',
  'EE NI', 'ER NI', 'EE Pension', 'ER Pension', 'Tax', 'SL',
  'Net Pay',
]

export function exportMoneysoft(input: PayRunExportInput): CsvFile {
  const rows = input.rows.map((r, i) => {
    const normalPay = r.grossWeekday + r.grossWeekend + r.grossBankHoliday +
                      r.grossChristmas + r.grossNight + r.grossSleepInTotal
    const normalHours = r.hoursWeekday + r.hoursWeekend + r.hoursBankHoliday + r.hoursChristmas

    return [
      r.employeeNumber, r.lastName, r.firstName, r.niNumber, r.taxCode, r.niCategory,
      r.weeksInPeriod === 1 ? 'W' : r.weeksInPeriod === 4 ? 'Q' : 'M',
      String(i + 1),     // tax period — sequential
      r.payDay,
      penceToGbp(normalHours * 60),
      penceToGbp(r.rateWeekday),
      penceToGbp(normalPay),
      penceToGbp(r.hoursOvertime * 60),
      penceToGbp(r.rateOvertime),
      penceToGbp(r.grossOvertime),
      penceToGbp(r.grossHoliday),
      penceToGbp(r.sspAmount),
      '0.00',
      penceToGbp(r.grossTraining),
      penceToGbp(r.grossTotal),
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
    filename: `payroll-moneysoft-${input.payRunId}.csv`,
    content: buildCsv(HEADERS, rows),
    format: 'moneysoft',
  }
}
