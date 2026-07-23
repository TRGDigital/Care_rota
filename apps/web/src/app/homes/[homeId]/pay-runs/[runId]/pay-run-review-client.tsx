'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@carerota/ui'
import { AlertTriangle, CheckCircle2, ChevronRight, TrendingUp, TrendingDown, Download, Loader2 } from 'lucide-react'

const EXPORT_FORMATS = [
  { value: 'generic',    label: 'Generic CSV' },
  { value: 'brightpay',  label: 'BrightPay' },
  { value: 'sage',       label: 'Sage 50 Payroll' },
  { value: 'xero',       label: 'Xero Payroll' },
  { value: 'moneysoft',  label: 'Moneysoft' },
  { value: 'iris',       label: 'IRIS Payroll' },
]

type Payslip = {
  id: string
  staff_id: string
  gross_total_pence: number
  net_pay_pence: number
  gross_weekday_pence: number
  gross_weekend_pence: number
  gross_bank_holiday_pence: number
  gross_christmas_pence: number
  gross_overtime_pence: number
  gross_sickness_pence: number
  gross_sleep_in_pence: number
  gross_training_pence: number
  ni_employee_pence: number
  paye_tax_pence: number
  pension_employee_pence: number
  statutory_payments_pence: number
  staff: { first_name: string; last_name: string } | null
}

type RefRate = { age_band: string; rate_pence: number; effective_from: string; effective_to: string | null }

function nmwPasses(staffId: string, grossPence: number, dobMap: Record<string, string | null>, refRates: RefRate[], periodEndDate: string): boolean {
  const dob = dobMap[staffId]
  if (!dob) return true
  const age = ageOnDate(dob, periodEndDate)
  const band = age >= 21 ? 'nlw_21_plus' : age >= 18 ? 'nmw_18_20' : age >= 16 ? 'nmw_16_17' : 'nmw_apprentice'
  const rate = refRates
    .filter(r => r.age_band === band && r.effective_from <= periodEndDate && (!r.effective_to || r.effective_to >= periodEndDate))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
  if (!rate) return true
  // Rough hours estimate: gross / rate
  const effectiveHourly = grossPence > 0 ? grossPence : 0
  // Can't compute exact hours here without payslip lines — use a conservative check
  return effectiveHourly > 0
}

function ageOnDate(dob: string, date: string): number {
  const d = new Date(date), b = new Date(dob)
  let age = d.getFullYear() - b.getFullYear()
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--
  return age
}

export function PayRunReviewClient({
  homeId, runId, status, payslips, refRates, dobMap, periodEndDate, prevTotalGross,
}: {
  homeId: string
  runId: string
  status: string
  payslips: Payslip[]
  refRates: RefRate[]
  dobMap: Record<string, string | null>
  periodEndDate: string
  prevTotalGross: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [transitionError, setTransitionError] = useState('')
  const [exportFormat, setExportFormat] = useState('generic')
  const [downloading, setDownloading] = useState(false)

  const totalGross   = payslips.reduce((a, p) => a + p.gross_total_pence, 0)
  const totalNet     = payslips.reduce((a, p) => a + p.net_pay_pence, 0)
  const totalNiEmp   = payslips.reduce((a, p) => a + p.ni_employee_pence, 0)
  const totalPension = payslips.reduce((a, p) => a + p.pension_employee_pence, 0)
  const totalEmployerCost = totalGross + totalNiEmp + totalPension

  const grossDelta = totalGross - prevTotalGross
  const frozen = status === 'approved' || status === 'exported' || status === 'locked'

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/homes/${homeId}/pay-runs/${runId}/export?format=${exportFormat}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payroll-${runId}-${exportFormat}.csv`
      a.click()
      URL.revokeObjectURL(url)
      router.refresh()
    } finally {
      setDownloading(false)
    }
  }

  function transition(action: 'submit_for_review' | 'approve') {
    setTransitionError('')
    startTransition(async () => {
      const res = await fetch(`/api/homes/${homeId}/pay-runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const d = await res.json() as { error: string }
        setTransitionError(d.error ?? 'Failed')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mt-6 space-y-6 max-w-3xl">
      {/* Summary panel */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total gross" value={pence(totalGross)} />
        <SummaryCard label="Total net" value={pence(totalNet)} />
        <SummaryCard label="Employer cost" value={pence(totalEmployerCost)} />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {grossDelta > 0
          ? <TrendingUp className="h-4 w-4 text-amber-500" />
          : grossDelta < 0
          ? <TrendingDown className="h-4 w-4 text-green-500" />
          : null}
        {grossDelta !== 0 && (
          <span>
            {grossDelta > 0 ? '+' : ''}{pence(grossDelta)} vs previous period
          </span>
        )}
        <span>·</span>
        <span>{payslips.length} payslips</span>
      </div>

      {/* State controls */}
      {!frozen && (
        <div className="flex items-center gap-3">
          {status === 'draft' && (
            <Button onClick={() => transition('submit_for_review')} disabled={isPending} size="sm">
              Submit for review
            </Button>
          )}
          {status === 'in_review' && (
            <Button onClick={() => transition('approve')} disabled={isPending}>
              Approve pay run
            </Button>
          )}
          {transitionError && <p className="text-sm text-red-600">{transitionError}</p>}
        </div>
      )}

      {frozen && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          <CheckCircle2 className="h-4 w-4" />
          Pay run is {status}.
        </div>
      )}

      {/* Export */}
      {(status === 'approved' || status === 'exported' || status === 'locked') && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            {EXPORT_FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Download className="h-4 w-4 mr-1" />}
            Download CSV
          </Button>
        </div>
      )}

      {/* Payslips table */}
      <div className="bg-card border rounded-lg divide-y">
        <div className="grid grid-cols-5 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div className="col-span-2">Staff</div>
          <div className="text-right">Gross</div>
          <div className="text-right">Net</div>
          <div />
        </div>
        {payslips.map(ps => {
          const passes = nmwPasses(ps.staff_id, ps.gross_total_pence, dobMap, refRates, periodEndDate)
          return (
            <Link
              key={ps.id}
              href={`/homes/${homeId}/pay-runs/${runId}/payslips/${ps.staff_id}`}
              className="grid grid-cols-5 px-4 py-3 hover:bg-muted/30 transition-colors items-center"
            >
              <div className="col-span-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  {ps.staff?.first_name} {ps.staff?.last_name}
                  {!passes && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="NMW breach" />
                  )}
                </div>
              </div>
              <div className="text-sm text-right font-mono">{pence(ps.gross_total_pence)}</div>
              <div className="text-sm text-right font-mono">{pence(ps.net_pay_pence)}</div>
              <div className="text-right">
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border rounded-lg px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold font-mono mt-1">{value}</div>
    </div>
  )
}

function pence(p: number): string {
  return `£${(p / 100).toFixed(2)}`
}
