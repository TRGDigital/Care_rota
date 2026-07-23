export type YearEndStaffRow = {
  staffId: string
  firstName: string
  lastName: string
  niNumber: string
  totalGrossPence: number
  totalPayeTaxPence: number
  totalNiEmployeePence: number
  totalNiEmployerPence: number
  totalPensionEmployeePence: number
  totalPensionEmployerPence: number
  totalNetPayPence: number
}

export type YearEndSummaryInput = {
  taxYearStart: string  // e.g. '2025-04-06'
  taxYearEnd:   string  // e.g. '2026-04-05'
  homeName:     string
  payslips: {
    staffId: string
    firstName: string
    lastName: string
    niNumber: string | null
    grossTotalPence: number
    payeTaxPence: number
    niEmployeePence: number
    niEmployerPence: number
    pensionEmployeePence: number
    pensionEmployerPence: number
    netPayPence: number
  }[]
}

export type YearEndSummaryResult = {
  taxYearStart:  string
  taxYearEnd:    string
  homeName:      string
  rows:          YearEndStaffRow[]
  totalGross:    number
  totalTax:      number
  totalNiEe:     number
  totalNiEr:     number
  totalPensionEe: number
  totalPensionEr: number
  totalNet:      number
}

export function buildYearEndSummary(input: YearEndSummaryInput): YearEndSummaryResult {
  const byStaff = new Map<string, YearEndStaffRow>()

  for (const ps of input.payslips) {
    const existing = byStaff.get(ps.staffId)
    if (existing) {
      existing.totalGrossPence           += ps.grossTotalPence
      existing.totalPayeTaxPence         += ps.payeTaxPence
      existing.totalNiEmployeePence      += ps.niEmployeePence
      existing.totalNiEmployerPence      += ps.niEmployerPence
      existing.totalPensionEmployeePence += ps.pensionEmployeePence
      existing.totalPensionEmployerPence += ps.pensionEmployerPence
      existing.totalNetPayPence          += ps.netPayPence
    } else {
      byStaff.set(ps.staffId, {
        staffId:                    ps.staffId,
        firstName:                  ps.firstName,
        lastName:                   ps.lastName,
        niNumber:                   ps.niNumber ?? '',
        totalGrossPence:            ps.grossTotalPence,
        totalPayeTaxPence:          ps.payeTaxPence,
        totalNiEmployeePence:       ps.niEmployeePence,
        totalNiEmployerPence:       ps.niEmployerPence,
        totalPensionEmployeePence:  ps.pensionEmployeePence,
        totalPensionEmployerPence:  ps.pensionEmployerPence,
        totalNetPayPence:           ps.netPayPence,
      })
    }
  }

  const rows = [...byStaff.values()].sort((a, b) => a.lastName.localeCompare(b.lastName))

  return {
    taxYearStart:   input.taxYearStart,
    taxYearEnd:     input.taxYearEnd,
    homeName:       input.homeName,
    rows,
    totalGross:     rows.reduce((a, r) => a + r.totalGrossPence, 0),
    totalTax:       rows.reduce((a, r) => a + r.totalPayeTaxPence, 0),
    totalNiEe:      rows.reduce((a, r) => a + r.totalNiEmployeePence, 0),
    totalNiEr:      rows.reduce((a, r) => a + r.totalNiEmployerPence, 0),
    totalPensionEe: rows.reduce((a, r) => a + r.totalPensionEmployeePence, 0),
    totalPensionEr: rows.reduce((a, r) => a + r.totalPensionEmployerPence, 0),
    totalNet:       rows.reduce((a, r) => a + r.totalNetPayPence, 0),
  }
}
