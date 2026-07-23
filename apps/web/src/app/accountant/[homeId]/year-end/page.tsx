import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { buildYearEndSummary } from '@carerota/domain'

function pence(n: number) {
  return `£${(n / 100).toFixed(2)}`
}

export default async function AccountantYearEndPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>
  searchParams: Promise<{ taxYear?: string }>
}) {
  const { homeId } = await params
  const { taxYear } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: invitation } = await supabase
    .from('accountant_invitations')
    .select('id')
    .eq('user_id', user.id)
    .eq('home_id', homeId)
    .is('revoked_at', null)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!invitation) redirect('/accountant/dashboard')

  const { data: home } = await supabase
    .from('homes')
    .select('id, name')
    .eq('id', homeId)
    .single()

  if (!home) redirect('/accountant/dashboard')

  // Determine tax year — default to current
  const now = new Date()
  const currentTaxYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const selectedYear = taxYear ? parseInt(taxYear) : currentTaxYearStart
  const yearStart = `${selectedYear}-04-06`
  const yearEnd   = `${selectedYear + 1}-04-05`

  // Pull all approved payslips in this tax year
  const { data: payslips } = await supabase
    .from('payslips')
    .select(`
      staff_id, gross_total_pence, paye_tax_pence,
      ni_employee_pence, ni_employer_pence,
      pension_employee_pence, pension_employer_pence,
      net_pay_pence,
      staff!inner ( first_name, last_name, ni_number ),
      pay_runs!inner ( status, pay_periods!inner ( period_end_date ) )
    `)
    .eq('home_id', homeId)
    .in('pay_runs.status', ['approved', 'exported', 'locked'])
    .gte('pay_runs.pay_periods.period_end_date', yearStart)
    .lte('pay_runs.pay_periods.period_end_date', yearEnd)

  type StaffJoin = { first_name: string; last_name: string; ni_number: string | null }

  const summary = buildYearEndSummary({
    taxYearStart: yearStart,
    taxYearEnd:   yearEnd,
    homeName:     home.name,
    payslips: (payslips ?? []).map(ps => {
      const s = ps.staff as StaffJoin | null
      return {
        staffId:             ps.staff_id,
        firstName:           s?.first_name ?? '',
        lastName:            s?.last_name  ?? '',
        niNumber:            s?.ni_number  ?? null,
        grossTotalPence:     ps.gross_total_pence,
        payeTaxPence:        ps.paye_tax_pence,
        niEmployeePence:     ps.ni_employee_pence,
        niEmployerPence:     ps.ni_employer_pence,
        pensionEmployeePence: ps.pension_employee_pence,
        pensionEmployerPence: ps.pension_employer_pence,
        netPayPence:         ps.net_pay_pence,
      }
    }),
  })

  // Available years — offer current and two prior
  const yearOptions = [currentTaxYearStart - 1, currentTaxYearStart, currentTaxYearStart + 1]
    .filter(y => y <= currentTaxYearStart)

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
        <div>
          <Link
            href={`/accountant/${homeId}/pay-runs`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ChevronLeft className="h-4 w-4" /> Pay runs
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">Year-end summary</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {home.name} · Tax year {selectedYear}/{String(selectedYear + 1).slice(2)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Tax year:</label>
              <select
                defaultValue={selectedYear}
                className="border rounded px-3 py-1.5 text-sm"
                onChange={e => {
                  window.location.href = `/accountant/${homeId}/year-end?taxYear=${e.target.value}`
                }}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}/{String(y + 1).slice(2)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total gross',   value: pence(summary.totalGross) },
            { label: 'Total PAYE',    value: pence(summary.totalTax)   },
            { label: 'Total NI (EE)', value: pence(summary.totalNiEe)  },
            { label: 'Total net pay', value: pence(summary.totalNet)   },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border rounded-lg px-4 py-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-lg font-semibold mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {/* Staff table */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-sm font-medium">
              {summary.rows.length} employee{summary.rows.length !== 1 ? 's' : ''}
            </p>
          </div>
          {summary.rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No approved pay runs in this tax year.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">NI number</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Gross</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">PAYE</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">NI (EE)</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Pension (EE)</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.rows.map(row => (
                    <tr key={row.staffId} className="hover:bg-muted/10">
                      <td className="px-4 py-3 font-medium">{row.lastName}, {row.firstName}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{row.niNumber || '—'}</td>
                      <td className="px-4 py-3 text-right">{pence(row.totalGrossPence)}</td>
                      <td className="px-4 py-3 text-right">{pence(row.totalPayeTaxPence)}</td>
                      <td className="px-4 py-3 text-right">{pence(row.totalNiEmployeePence)}</td>
                      <td className="px-4 py-3 text-right">{pence(row.totalPensionEmployeePence)}</td>
                      <td className="px-4 py-3 text-right font-medium">{pence(row.totalNetPayPence)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/20 font-medium">
                    <td className="px-4 py-3" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right">{pence(summary.totalGross)}</td>
                    <td className="px-4 py-3 text-right">{pence(summary.totalTax)}</td>
                    <td className="px-4 py-3 text-right">{pence(summary.totalNiEe)}</td>
                    <td className="px-4 py-3 text-right">{pence(summary.totalPensionEe)}</td>
                    <td className="px-4 py-3 text-right">{pence(summary.totalNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
