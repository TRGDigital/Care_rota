import type { PayslipResult, NmwCheckResult, StaffMember, ReferenceWageRate } from './types'
import { resolveNmwFloor } from './rates'

export function checkNmwFloors(
  payslips: PayslipResult[],
  staff: StaffMember[],
  referenceWageRates: ReferenceWageRate[],
  periodEndDate: string
): NmwCheckResult[] {
  return payslips.map(ps => {
    const member = staff.find(s => s.id === ps.staffId)
    const floorPence = member
      ? resolveNmwFloor(referenceWageRates, member.date_of_birth, periodEndDate)
      : 0

    // Total payable (non-statutory) hours worked
    const payableMinutes =
      Number(ps.lines
        .filter(l => !l.lineType.startsWith('statutory') && !l.lineType.startsWith('pension') &&
                     l.lineType !== 'paye_tax' && l.lineType !== 'ni_employee' &&
                     l.lineType !== 'ni_employer' && l.lineType !== 'student_loan')
        .reduce((acc, l) => acc + BigInt(l.minutes), 0n))

    // effective_hourly_rate_pence = gross_total_pence / payable_hours
    //   = gross_total_pence * 60 / payable_minutes (integer arithmetic, no float)
    const effectiveHourlyPenceTimes60 =
      payableMinutes > 0
        ? (ps.grossTotalPence * 60n) / BigInt(payableMinutes)
        : 0n

    // Compare effective hourly rate (pence/hr) against NLW/NMW floor (pence/hr)
    const passes = floorPence === 0 || effectiveHourlyPenceTimes60 >= BigInt(floorPence)

    return { staffId: ps.staffId, effectiveHourlyPenceTimes60, floorPence, passes }
  })
}
