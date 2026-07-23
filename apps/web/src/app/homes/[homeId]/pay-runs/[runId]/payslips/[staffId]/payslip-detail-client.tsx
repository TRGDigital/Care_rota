'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@carerota/ui'
import { Download, Plus, MessageSquare, Send } from 'lucide-react'

type PayslipLine = {
  id: string
  line_type: string
  description: string
  hours: number | null
  rate_pence: number | null
  multiplier: number
  amount_pence: number
  source_shift_ids: string[]
}

type Payslip = {
  id: string
  gross_total_pence: number
  net_pay_pence: number
  statutory_payments_pence: number
  pension_employee_pence: number
  pension_employer_pence: number
  paye_tax_pence: number
  ni_employee_pence: number
  ni_employer_pence: number
  student_loan_pence: number
  tax_code: string | null
  ni_category: string | null
}

const EARNINGS_TYPES = new Set([
  'basic_weekday', 'basic_weekend', 'bank_holiday', 'christmas', 'night',
  'overtime', 'training', 'holiday', 'sickness', 'sleep_in',
  'statutory_ssp', 'statutory_smp',
])

const DEDUCTION_TYPES = new Set([
  'pension_employee', 'paye_tax', 'ni_employee', 'student_loan',
])

type Comment = {
  id: string
  body: string
  author_name: string | null
  created_at: string
  is_accountant: boolean
}

export function PayslipDetailClient({
  homeId, payslipId, payslip, lines, staffName, roleCode, runStatus, runId, comments: initialComments,
}: {
  homeId: string
  payslipId: string
  payslip: Payslip
  lines: PayslipLine[]
  staffName: string
  roleCode: string
  runStatus: string
  runId: string
  comments: Comment[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [overrideDesc, setOverrideDesc] = useState('')
  const [overrideAmount, setOverrideAmount] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [error, setError] = useState('')
  const [comments, setComments] = useState(initialComments)
  const [commentBody, setCommentBody] = useState('')

  const frozen = runStatus === 'approved' || runStatus === 'exported' || runStatus === 'locked'

  const earningsLines  = lines.filter(l => EARNINGS_TYPES.has(l.line_type))
  const deductionLines = lines.filter(l => DEDUCTION_TYPES.has(l.line_type))

  function handleAddLine() {
    if (!overrideDesc.trim() || !overrideAmount || !overrideReason.trim()) return
    setError('')
    startTransition(async () => {
      const res = await fetch(`/api/homes/${homeId}/payslips/${payslipId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'manual_line',
          description: overrideDesc.trim(),
          amountPence: Math.round(parseFloat(overrideAmount) * 100),
          reason: overrideReason.trim(),
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error: string }
        setError(d.error ?? 'Failed')
        return
      }
      setShowOverrideForm(false)
      setOverrideDesc(''); setOverrideAmount(''); setOverrideReason('')
      router.refresh()
    })
  }

  function handleAddComment() {
    if (!commentBody.trim()) return
    const body = commentBody.trim()
    setCommentBody('')
    startTransition(async () => {
      const res = await fetch(`/api/homes/${homeId}/payroll-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payRunId: runId, body }),
      })
      if (res.ok) {
        const newComment = await res.json() as Comment
        setComments(prev => [...prev, newComment])
      }
    })
  }

  function handleDoNotPay() {
    if (!confirm(`Mark ${staffName}'s payslip as "do not pay this period"?`)) return
    startTransition(async () => {
      await fetch(`/api/homes/${homeId}/payslips/${payslipId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'do_not_pay', reason: 'Manager: do not pay this period' }),
      })
      router.refresh()
    })
  }

  return (
    <div className="max-w-2xl mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{staffName}</div>
          <div className="text-sm text-muted-foreground">{roleCode}</div>
        </div>
        <Link href={`/homes/${homeId}/pay-runs`}>
          <Button variant="outline" size="sm">Back to pay run</Button>
        </Link>
      </div>

      {/* Earnings */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Earnings</h3>
        <div className="bg-card border rounded-lg divide-y">
          {earningsLines.map(l => (
            <div key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div className="flex-1">
                <span>{l.description}</span>
                {l.hours != null && l.hours > 0 && (
                  <span className="text-muted-foreground ml-2">
                    {l.hours.toFixed(2)} hrs
                    {l.rate_pence ? ` @ £${(l.rate_pence / 100).toFixed(2)}` : ''}
                    {l.multiplier !== 1 ? ` × ${l.multiplier}` : ''}
                  </span>
                )}
                {l.source_shift_ids.length > 0 && (
                  <span className="text-xs text-blue-600 ml-2">
                    {l.source_shift_ids.length} shift{l.source_shift_ids.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <span className="font-mono ml-4">{pence(l.amount_pence)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold">
            <span>Gross pay</span>
            <span className="font-mono">{pence(payslip.gross_total_pence)}</span>
          </div>
        </div>
      </section>

      {/* Deductions */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Deductions</h3>
        <div className="bg-card border rounded-lg divide-y">
          {deductionLines.map(l => (
            <div key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{l.description}</span>
              <span className="font-mono text-red-600 ml-4">−{pence(Math.abs(l.amount_pence))}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold">
            <span>Net pay</span>
            <span className="font-mono text-green-700">{pence(payslip.net_pay_pence)}</span>
          </div>
        </div>
      </section>

      {/* Comments */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Comments ({comments.length})
          </h3>
        </div>
        <div className="bg-card border rounded-lg overflow-hidden">
          {comments.length > 0 && (
            <div className="divide-y max-h-60 overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className={`px-4 py-3 ${c.is_accountant ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{c.author_name ?? (c.is_accountant ? 'Accountant' : 'Manager')}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          )}
          <div className="p-3 border-t flex gap-2">
            <textarea
              className="flex-1 border rounded px-3 py-2 text-sm resize-none"
              rows={2}
              placeholder="Add a comment…"
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment()
              }}
            />
            <Button size="sm" onClick={handleAddComment} disabled={isPending || !commentBody.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Override actions */}
      {!frozen && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Manager actions</h3>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowOverrideForm(v => !v)}>
              <Plus className="h-4 w-4 mr-1" />Add manual line
            </Button>
            <Button variant="outline" size="sm" onClick={handleDoNotPay} disabled={isPending}>
              Do not pay this period
            </Button>
          </div>

          {showOverrideForm && (
            <div className="bg-card border rounded-lg p-4 space-y-3">
              <input
                type="text"
                placeholder="Description (e.g. One-off bonus)"
                className="w-full border rounded px-3 py-2 text-sm"
                value={overrideDesc}
                onChange={e => setOverrideDesc(e.target.value)}
              />
              <input
                type="number"
                placeholder="Amount (£)"
                step="0.01"
                className="w-full border rounded px-3 py-2 text-sm"
                value={overrideAmount}
                onChange={e => setOverrideAmount(e.target.value)}
              />
              <input
                type="text"
                placeholder="Reason for override (mandatory)"
                className="w-full border rounded px-3 py-2 text-sm"
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddLine} disabled={isPending}>Add line</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowOverrideForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function pence(p: number): string {
  return `£${(Math.abs(p) / 100).toFixed(2)}`
}
