import { Fragment } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtHours(h: number) {
  return h % 1 === 0 ? `${h.toLocaleString('en-GB')}h` : `${h.toLocaleString('en-GB', { maximumFractionDigits: 1 })}h`
}

function fmtGBP(pence: number) {
  const pounds = Math.round(pence / 100)
  return `£${pounds.toLocaleString('en-GB')}`
}

export default async function HolidayCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>
  searchParams: Promise<{ year?: string }>
}) {
  const { homeId } = await params
  const { year: yearParam } = await searchParams
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-11
  const year = yearParam ? parseInt(yearParam) : currentYear
  const today = now.toISOString().slice(0, 10)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: home } = await supabase
    .from('homes')
    .select('holiday_allocation_unit')
    .eq('id', homeId)
    .single()

  const unit = home?.holiday_allocation_unit === 'hours' ? 'h' : 'd'

  const { data: staffList } = await supabase
    .from('staff')
    .select('id, first_name, last_name')
    .eq('home_id', homeId)
    .eq('status', 'active')
    .order('last_name')
    .order('first_name')

  const staffIds = (staffList ?? []).map(s => s.id)
  const nullGuard = staffIds.length ? staffIds : ['00000000-0000-0000-0000-000000000000']

  const [
    { data: balances },
    { data: leaveRequests },
    { data: payRates },
  ] = await Promise.all([
    supabase
      .from('leave_balances')
      .select('staff_id, entitlement_value, taken_value, booked_value, balance_remaining, allocation_unit')
      .in('staff_id', nullGuard)
      .eq('leave_year_start', `${year}-01-01`),

    supabase
      .from('leave_requests')
      .select('staff_id, start_date, end_date, value_requested, status')
      .in('staff_id', nullGuard)
      .in('status', ['approved', 'pending'])
      .gte('start_date', `${year}-01-01`)
      .lt('start_date', `${year + 1}-01-01`),

    supabase
      .from('staff_pay_rates')
      .select('staff_id, rate_weekday_pence')
      .eq('home_id', homeId)
      .order('effective_from', { ascending: false }),
  ])

  // Latest pay rate per staff
  const rateByStaff = new Map<string, number>()
  for (const pr of payRates ?? []) {
    if (!rateByStaff.has(pr.staff_id)) rateByStaff.set(pr.staff_id, pr.rate_weekday_pence)
  }

  const balByStaff = new Map<string, NonNullable<typeof balances>[number]>()
  for (const b of balances ?? []) balByStaff.set(b.staff_id, b)

  // Split approved requests into taken (end_date passed) vs booked (future/current)
  const monthsTaken   = new Map<string, number[]>()
  const monthsBooked  = new Map<string, number[]>()
  const monthsPending = new Map<string, number[]>()

  for (const id of staffIds) {
    monthsTaken.set(id, Array(12).fill(0))
    monthsBooked.set(id, Array(12).fill(0))
    monthsPending.set(id, Array(12).fill(0))
  }

  for (const lr of leaveRequests ?? []) {
    const m = new Date(lr.start_date).getMonth()
    if (lr.status === 'approved') {
      const arr = lr.end_date < today
        ? monthsTaken.get(lr.staff_id)
        : monthsBooked.get(lr.staff_id)
      if (arr) arr[m] = (arr[m] ?? 0) + Number(lr.value_requested)
    } else if (lr.status === 'pending') {
      const arr = monthsPending.get(lr.staff_id)
      if (arr) arr[m] = (arr[m] ?? 0) + Number(lr.value_requested)
    }
  }

  const rows = (staffList ?? []).map(s => {
    const bal = balByStaff.get(s.id)
    return {
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      entitlement: Number(bal?.entitlement_value ?? 0),
      taken:       Number(bal?.taken_value ?? 0),
      booked:      Number(bal?.booked_value ?? 0),
      remaining:   bal?.balance_remaining != null ? Number(bal.balance_remaining) : null,
      monthsTaken:   monthsTaken.get(s.id)   ?? Array(12).fill(0),
      monthsBooked:  monthsBooked.get(s.id)  ?? Array(12).fill(0),
      monthsPending: monthsPending.get(s.id) ?? Array(12).fill(0),
      hasBalance: !!bal,
      ratePence: rateByStaff.get(s.id) ?? 0,
    }
  })

  // Summary totals — driven from leave_requests monthly data so they match the bottom table
  let totalEntitlementHours = 0, totalTakenHours = 0, totalBookedHours = 0
  let totalEntitlementPence = 0, totalTakenPence = 0, totalBookedPence = 0
  for (const r of rows) {
    if (!r.hasBalance) continue
    const takenHrs  = r.monthsTaken.reduce((a, b) => a + b, 0)
    const bookedHrs = r.monthsBooked.reduce((a, b) => a + b, 0)
    totalEntitlementHours += r.entitlement
    totalTakenHours       += takenHrs
    totalBookedHours      += bookedHrs
    totalEntitlementPence += r.entitlement * r.ratePence
    totalTakenPence       += takenHrs      * r.ratePence
    totalBookedPence      += bookedHrs     * r.ratePence
  }
  const totalRemainingHours = totalEntitlementHours - totalTakenHours - totalBookedHours
  const totalRemainingPence = totalEntitlementPence - totalTakenPence - totalBookedPence
  const pctTaken  = totalEntitlementHours > 0 ? Math.round((totalTakenHours  / totalEntitlementHours) * 100) : 0
  const pctBooked = totalEntitlementHours > 0 ? Math.round((totalBookedHours / totalEntitlementHours) * 100) : 0
  const pctUsedTotal = pctTaken + pctBooked

  // Monthly totals across all staff
  const monthTakenTotals  = Array(12).fill(0) as number[]
  const monthBookedTotals = Array(12).fill(0) as number[]
  for (const row of rows) {
    for (let i = 0; i < 12; i++) {
      monthTakenTotals[i]  += row.monthsTaken[i]  ?? 0
      monthBookedTotals[i] += row.monthsBooked[i] ?? 0
    }
  }

  const isCurrentYear = year === currentYear

  const availableYears = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2]
    .filter(y => y >= 2024)

  const hasAnyBalance  = rows.some(r => r.hasBalance)
  const hasAnyRequests = (leaveRequests?.length ?? 0) > 0

  return (
    <div className="p-6">

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Holiday calendar</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {year} leave year · all values in {unit === 'h' ? 'hours' : 'days'}
          </p>
        </div>

        {/* Year picker */}
        <div className="flex items-center gap-2">
          {availableYears.map(y => (
            <Link
              key={y}
              href={`?year=${y}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                y === year
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted'
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {!staffList?.length ? (
        <p className="text-sm text-muted-foreground">No active staff found.</p>
      ) : !hasAnyBalance ? (
        <div className="rounded-xl bg-card border p-6 text-center">
          <p className="text-sm font-medium text-foreground">No leave balance data for {year}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Select a different year above, or check Settings to ensure the holiday allocation unit is configured.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stat blocks */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">

            {/* Total entitlement */}
            <div className="rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total entitlement</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{fmtHours(totalEntitlementHours)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{fmtGBP(totalEntitlementPence)} payroll value</p>
            </div>

            {/* Already taken */}
            <div className="rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Already taken</p>
                <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{pctTaken}%</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-green-700">{fmtHours(totalTakenHours)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{fmtGBP(totalTakenPence)} payroll value</p>
            </div>

            {/* Already booked */}
            <div className="rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Already booked</p>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{pctBooked}%</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-blue-700">{fmtHours(totalBookedHours)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{fmtGBP(totalBookedPence)} payroll value</p>
            </div>

            {/* Remaining */}
            <div className="rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remaining</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  pctUsedTotal >= 100 ? 'text-destructive bg-red-50' :
                  pctUsedTotal >= 80  ? 'text-amber-700 bg-amber-50' :
                                        'text-muted-foreground bg-muted/40'
                }`}>{100 - pctUsedTotal}% left</span>
              </div>
              <p className={`mt-2 text-3xl font-bold ${
                totalRemainingHours < 0 ? 'text-destructive' :
                totalRemainingHours < totalEntitlementHours * 0.1 ? 'text-amber-600' :
                'text-foreground'
              }`}>{fmtHours(totalRemainingHours)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{fmtGBP(totalRemainingPence)} payroll value</p>
            </div>
          </div>

          {/* Calendar table */}
          <div className="rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border-separate border-spacing-0">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10 border-b min-w-[160px]">Staff</th>
                    {MONTHS.map((m, i) => (
                      <th key={m} className={`text-center py-3 px-1.5 font-medium min-w-[44px] border-b ${
                        isCurrentYear && i === currentMonth
                          ? 'bg-violet-100 text-violet-700 font-semibold'
                          : 'text-muted-foreground'
                      }`}>{m}</th>
                    ))}
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground border-b min-w-[64px]">Entitl.</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground border-b min-w-[56px]">Taken</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground border-b min-w-[60px]">Booked</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground border-b min-w-[72px]">Remaining</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground border-b min-w-[44px]">%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => {
                    const pctRowUsed = row.entitlement > 0
                      ? Math.round(((row.taken + row.booked) / row.entitlement) * 100)
                      : null
                    const remainingClass =
                      row.remaining === null             ? 'text-muted-foreground/40' :
                      row.remaining < 0                  ? 'text-destructive font-semibold' :
                      row.remaining < row.entitlement * 0.1 ? 'text-amber-600 font-medium' :
                                                          'text-green-700'
                    const pairBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-100'
                    // Current-month column overrides row bg
                    const colBg = (i: number) =>
                      isCurrentYear && i === currentMonth ? 'bg-violet-50' : pairBg

                    return (
                      <Fragment key={row.id}>
                        {/* Taken row */}
                        <tr className="hover:brightness-95">
                          <td className={`py-2.5 px-4 font-medium text-foreground sticky left-0 z-10 ${pairBg}`}>
                            {row.name}
                            {!row.hasBalance && <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">no data</span>}
                          </td>

                          {MONTHS.map((_, i) => {
                            const taken = row.monthsTaken[i] ?? 0
                            return (
                              <td key={i} className={`py-2.5 px-1 text-center ${colBg(i)}`}>
                                {taken > 0 ? (
                                  <span className="inline-block px-1 py-0.5 rounded bg-green-100 text-green-800 font-medium">{taken}</span>
                                ) : (
                                  <span className="text-muted-foreground/20">·</span>
                                )}
                              </td>
                            )
                          })}

                          <td className={`py-2.5 px-3 text-right tabular-nums text-muted-foreground ${pairBg}`}>
                            {row.entitlement > 0 ? row.entitlement : '—'}
                          </td>
                          <td className={`py-2.5 px-3 text-right tabular-nums text-muted-foreground ${pairBg}`}>
                            {row.hasBalance ? row.taken : '—'}
                          </td>
                          <td className={`py-2.5 px-3 text-right tabular-nums ${pairBg}`} />
                          <td className={`py-2.5 px-3 text-right tabular-nums ${remainingClass} ${pairBg}`}>
                            {row.remaining !== null ? row.remaining.toFixed(1) : '—'}
                          </td>
                          <td className={`py-2.5 px-3 text-right tabular-nums text-muted-foreground ${pairBg}`}>
                            {pctRowUsed !== null ? `${pctRowUsed}%` : '—'}
                          </td>
                        </tr>

                        {/* Booked sub-row */}
                        <tr className="border-b border-gray-100 hover:brightness-95">
                          <td className={`py-1.5 px-4 sticky left-0 z-10 ${pairBg}`}>
                            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider pl-2">Booked</span>
                          </td>

                          {MONTHS.map((_, i) => {
                            const booked  = row.monthsBooked[i]  ?? 0
                            const pending = row.monthsPending[i] ?? 0
                            return (
                              <td key={i} className={`py-1.5 px-1 text-center ${colBg(i)}`}>
                                {booked > 0 ? (
                                  <span className="inline-block px-1 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">{booked}</span>
                                ) : pending > 0 ? (
                                  <span className="inline-block px-1 py-0.5 rounded bg-amber-100 text-amber-800">{pending}</span>
                                ) : (
                                  <span className="text-muted-foreground/20">·</span>
                                )}
                              </td>
                            )
                          })}

                          <td className={`py-1.5 px-3 ${pairBg}`} />
                          <td className={`py-1.5 px-3 ${pairBg}`} />
                          <td className={`py-1.5 px-3 text-right tabular-nums text-blue-700 font-medium ${pairBg}`}>
                            {row.hasBalance ? (row.booked > 0 ? row.booked : '—') : '—'}
                          </td>
                          <td className={`py-1.5 px-3 ${pairBg}`} />
                          <td className={`py-1.5 px-3 ${pairBg}`} />
                        </tr>
                      </Fragment>
                    )
                  })}
                  {/* Monthly totals rows */}
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-2.5 px-4 sticky left-0 z-10 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Taken total
                    </td>
                    {monthTakenTotals.map((total, i) => (
                      <td key={i} className={`py-2.5 px-1 text-center bg-muted/30 ${isCurrentYear && i === currentMonth ? 'bg-violet-100' : ''}`}>
                        {total > 0
                          ? <span className="inline-block px-1 py-0.5 rounded bg-green-200 text-green-900 font-semibold">{total}</span>
                          : <span className="text-muted-foreground/20">·</span>}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 bg-muted/30" />
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-green-800 bg-muted/30">
                      {fmtHours(monthTakenTotals.reduce((a, b) => a + b, 0))}
                    </td>
                    <td className="py-2.5 px-3 bg-muted/30" />
                    <td className="py-2.5 px-3 bg-muted/30" />
                    <td className="py-2.5 px-3 bg-muted/30" />
                  </tr>
                  <tr className="border-b-2 border-gray-200">
                    <td className="py-2 px-4 sticky left-0 z-10 bg-muted/30 text-xs font-semibold text-blue-600 uppercase tracking-wide pl-6">
                      Booked total
                    </td>
                    {monthBookedTotals.map((total, i) => (
                      <td key={i} className={`py-2 px-1 text-center bg-muted/30 ${isCurrentYear && i === currentMonth ? 'bg-violet-100' : ''}`}>
                        {total > 0
                          ? <span className="inline-block px-1 py-0.5 rounded bg-blue-200 text-blue-900 font-semibold">{total}</span>
                          : <span className="text-muted-foreground/20">·</span>}
                      </td>
                    ))}
                    <td className="py-2 px-3 bg-muted/30" />
                    <td className="py-2 px-3 bg-muted/30" />
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-blue-800 bg-muted/30">
                      {fmtHours(monthBookedTotals.reduce((a, b) => a + b, 0))}
                    </td>
                    <td className="py-2 px-3 bg-muted/30" />
                    <td className="py-2 px-3 bg-muted/30" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200" />
              Taken (payroll confirmed)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />
              Booked (approved, not yet payroll confirmed)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-200" />
              Pending approval
            </span>
            {!hasAnyRequests && (
              <span className="text-muted-foreground/60 italic">
                Monthly breakdown populates as staff submit leave requests.
              </span>
            )}
          </div>

          {/* Column guide — matches staff directory style */}
          <div className="mt-8 rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-6 py-3.5 border-b">
              <h2 className="text-sm font-semibold text-foreground">Column guide</h2>
            </div>
            <div className="px-6 py-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { col: 'Taken row',  desc: 'Green cells show payroll-confirmed leave per month. Summary columns show totals from the leave balance record.' },
                { col: 'Booked row', desc: 'Blue cells show approved leave not yet confirmed against payroll. Amber cells are pending approval.' },
                { col: 'Entitl.',    desc: 'Total annual leave entitlement for this leave year.' },
                { col: 'Taken',      desc: 'Hours confirmed against payroll so far this year.' },
                { col: 'Booked',     desc: 'Approved leave not yet finalised via payroll. Counts against the balance immediately.' },
                { col: 'Remaining',  desc: 'Entitlement minus Taken minus Booked. Red = over-booked. Amber = under 10% remaining.' },
                { col: '% used',     desc: 'Taken + Booked as a percentage of entitlement.' },
                { col: 'Payroll £',  desc: 'Top cards show the payroll cost of each category based on each staff member\'s contracted weekday hourly rate.' },
              ].map(({ col, desc }) => (
                <div key={col} className="flex gap-2 text-sm">
                  <span className="font-medium text-foreground shrink-0 w-28">{col}</span>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
