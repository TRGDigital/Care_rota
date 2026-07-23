'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@carerota/ui'
import { Download, FileCheck, MessageSquare, Send, Loader2 } from 'lucide-react'

type Payslip = {
  id: string
  staff_id: string
  gross_total_pence: number
  net_pay_pence: number
  paye_tax_pence: number
  ni_employee_pence: number
  pension_employee_pence: number
  staff: { first_name: string; last_name: string } | null
}

type Comment = {
  id: string
  body: string
  author_name: string | null
  created_at: string
  is_accountant: boolean
}

type Props = {
  homeId: string
  runId: string
  status: string
  filedAt: string | null
  payslips: Payslip[]
  comments: Comment[]
  exportFormat: string
}

function pence(n: number) {
  return `£${(n / 100).toFixed(2)}`
}

export function AccountantRunClient({
  homeId, runId, status, filedAt, payslips, comments: initialComments, exportFormat,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [comments, setComments] = useState(initialComments)
  const [commentBody, setCommentBody] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [filing, setFiling] = useState(false)

  const totalGross = payslips.reduce((a, p) => a + p.gross_total_pence, 0)
  const totalNet = payslips.reduce((a, p) => a + p.net_pay_pence, 0)
  const totalTax = payslips.reduce((a, p) => a + p.paye_tax_pence, 0)
  const totalNi = payslips.reduce((a, p) => a + p.ni_employee_pence, 0)

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/homes/${homeId}/pay-runs/${runId}/export?format=${exportFormat}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payroll-${runId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  async function handleMarkFiled() {
    if (!confirm('Mark this pay run as filed with HMRC?')) return
    setFiling(true)
    try {
      await fetch(`/api/homes/${homeId}/pay-runs/${runId}/filed`, { method: 'POST' })
      router.refresh()
    } finally {
      setFiling(false)
    }
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

  return (
    <div className="space-y-6">
      {/* Totals banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total gross', value: pence(totalGross) },
          { label: 'Total PAYE', value: pence(totalTax) },
          { label: 'Total NI (EE)', value: pence(totalNi) },
          { label: 'Total net pay', value: pence(totalNet) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border rounded-lg px-4 py-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
          {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Download {exportFormat.toUpperCase()} CSV
        </Button>
        {!filedAt && (status === 'approved' || status === 'exported' || status === 'locked') && (
          <Button size="sm" variant="outline" onClick={handleMarkFiled} disabled={filing}>
            <FileCheck className="h-4 w-4 mr-1" />
            Mark as filed
          </Button>
        )}
        {filedAt && (
          <span className="inline-flex items-center gap-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
            <FileCheck className="h-4 w-4" /> Filed {new Date(filedAt).toLocaleDateString('en-GB')}
          </span>
        )}
      </div>

      {/* Payslip breakdown */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-sm font-medium">Payslip breakdown ({payslips.length} employees)</p>
        </div>
        <div className="divide-y">
          {payslips.map(ps => {
            const name = ps.staff
              ? `${ps.staff.first_name} ${ps.staff.last_name}`
              : ps.staff_id
            return (
              <div key={ps.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{name}</div>
                </div>
                <div className="flex gap-6 text-sm text-right shrink-0">
                  <div>
                    <div className="text-xs text-muted-foreground">Gross</div>
                    <div>{pence(ps.gross_total_pence)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">PAYE</div>
                    <div>{pence(ps.paye_tax_pence)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Net</div>
                    <div className="font-medium">{pence(ps.net_pay_pence)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Comments panel */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Comments ({comments.length})</p>
        </div>

        {comments.length > 0 && (
          <div className="divide-y max-h-72 overflow-y-auto">
            {comments.map(c => (
              <div key={c.id} className={`px-4 py-3 ${c.is_accountant ? 'bg-blue-50/50' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{c.author_name ?? 'Accountant'}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 border-t flex gap-2">
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
    </div>
  )
}
