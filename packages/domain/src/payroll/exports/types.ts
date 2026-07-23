export type ExportFormat = 'brightpay' | 'sage' | 'xero' | 'moneysoft' | 'iris' | 'generic_csv' | 'generic'

export type CsvFile = {
  filename: string
  content: string   // UTF-8 CSV text
  format: ExportFormat
}

// Canonical row fed to every adapter
export type PayRunExportRow = {
  employeeNumber: string
  firstName: string
  lastName: string
  niNumber: string
  taxCode: string
  niCategory: string
  periodStart: string
  periodEnd: string
  payDay: string
  weeksInPeriod: number

  hoursWeekday: number
  rateWeekday: number        // pence per hour
  grossWeekday: number       // pence

  hoursWeekend: number
  rateWeekend: number
  grossWeekend: number

  hoursBankHoliday: number
  rateBankHoliday: number
  multiplierBankHoliday: number
  grossBankHoliday: number

  hoursChristmas: number
  rateChristmas: number
  multiplierChristmas: number
  grossChristmas: number

  hoursNight: number
  rateNight: number
  grossNight: number

  hoursOvertime: number
  rateOvertime: number
  grossOvertime: number

  hoursTraining: number
  rateTraining: number
  grossTraining: number

  hoursHoliday: number
  rateHoliday: number
  grossHoliday: number

  hoursSickness: number
  sspAmount: number           // pence
  contractualSickAmount: number // pence

  sleepInCount: number        // number of sleep-in shifts
  sleepInFlatRate: number     // pence flat rate per shift
  hoursDisturbed: number
  grossSleepInTotal: number   // pence

  grossTotal: number          // pence

  pensionEmployee: number     // pence
  pensionEmployer: number     // pence
  payeTax: number             // pence
  niEmployee: number          // pence
  niEmployer: number          // pence
  studentLoan: number         // pence

  netPay: number              // pence
}

export type PayRunExportInput = {
  payRunId: string
  homeName: string
  format: ExportFormat
  rows: PayRunExportRow[]
}
