import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AddStaffModal } from './add-staff-modal'
import { StaffDirectoryClient } from './staff-directory-client'

export default async function StaffDirectoryPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { data: home },
    { data: staffList },
    { data: contracts },
    { data: payRates },
    { data: leaveBalances },
  ] = await Promise.all([
    supabase
      .from('homes')
      .select('holiday_allocation_unit')
      .eq('id', homeId)
      .single(),
    supabase
      .from('staff')
      .select('id, first_name, last_name, employee_number, status, overtime_weighting, overtime_eligible')
      .eq('home_id', homeId)
      .order('last_name')
      .order('first_name'),
    supabase
      .from('staff_contracts')
      .select('staff_id, contract_type, contracted_hours_per_week, holiday_entitlement_value')
      .eq('home_id', homeId)
      .order('effective_from', { ascending: false }),
    supabase
      .from('staff_pay_rates')
      .select('staff_id, role_code, rate_weekday_pence')
      .eq('home_id', homeId)
      .order('effective_from', { ascending: false }),
    supabase
      .from('leave_balances')
      .select('staff_id, entitlement_value, taken_value, balance_remaining, allocation_unit')
      .eq('home_id', homeId)
      .order('leave_year_start', { ascending: false }),
  ])

  const homeUnit = home?.holiday_allocation_unit === 'hours' ? 'h' : 'd'

  const contractByStaff = new Map<string, NonNullable<typeof contracts>[0]>()
  for (const c of contracts ?? []) {
    if (!contractByStaff.has(c.staff_id)) contractByStaff.set(c.staff_id, c)
  }
  const payRateByStaff = new Map<string, NonNullable<typeof payRates>[0]>()
  for (const r of payRates ?? []) {
    if (!payRateByStaff.has(r.staff_id)) payRateByStaff.set(r.staff_id, r)
  }
  const leaveByStaff = new Map<string, NonNullable<typeof leaveBalances>[0]>()
  for (const lb of leaveBalances ?? []) {
    if (!leaveByStaff.has(lb.staff_id)) leaveByStaff.set(lb.staff_id, lb)
  }

  const staff = staffList ?? []

  const enrichedStaff = staff.map(s => {
    const c  = contractByStaff.get(s.id)
    const pr = payRateByStaff.get(s.id)
    const lb = leaveByStaff.get(s.id)
    return {
      id:                s.id,
      first_name:        s.first_name,
      last_name:         s.last_name,
      employee_number:   s.employee_number ?? null,
      status:            s.status,
      overtime_weighting: s.overtime_weighting != null ? Number(s.overtime_weighting) : null,
      overtime_eligible:  s.overtime_eligible ?? null,
      contract: c ? {
        contract_type:               c.contract_type,
        contracted_hours_per_week:   c.contracted_hours_per_week,
        holiday_entitlement_value:   Number(c.holiday_entitlement_value),
      } : null,
      payRate: pr ? {
        role_code:           pr.role_code ?? null,
        rate_weekday_pence:  pr.rate_weekday_pence,
      } : null,
      leave: lb ? {
        entitlement_value: Number(lb.entitlement_value),
        taken_value:       Number(lb.taken_value),
        balance_remaining: lb.balance_remaining != null ? Number(lb.balance_remaining) : null,
        allocation_unit:   lb.allocation_unit ?? 'days',
      } : null,
    }
  })

  const activeStaff     = enrichedStaff.filter(s => s.status === 'active')
  const totalHrsWk      = activeStaff.reduce((sum, s) => sum + (s.contract?.contracted_hours_per_week ?? 0), 0)
  const activeWithRate  = activeStaff.filter(s => s.payRate != null)
  const avgRatePence    = activeWithRate.length > 0
    ? Math.round(activeWithRate.reduce((sum, s) => sum + (s.payRate!.rate_weekday_pence ?? 0), 0) / activeWithRate.length)
    : 0

  const statusCounts: Record<string, number> = {}
  for (const s of enrichedStaff) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1
  }

  return (
    <div className="px-6 py-8 lg:px-8 max-w-[1280px] mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Staff directory</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {staff.length} staff member{staff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <AddStaffModal homeId={homeId} />
      </div>

      <StaffDirectoryClient
        homeId={homeId}
        homeUnit={homeUnit}
        staff={enrichedStaff}
        stats={{ activeCount: activeStaff.length, totalHrsWk, avgRatePence }}
        statusCounts={statusCounts}
      />
    </div>
  )
}
