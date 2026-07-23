'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveLeaveRequest, rejectLeaveRequest } from '../actions'

const TYPE_LABELS: Record<string, string> = {
  annual: 'Annual leave', compassionate: 'Compassionate', maternity: 'Maternity',
  paternity: 'Paternity', shared_parental: 'Shared parental', adoption: 'Adoption',
  unpaid: 'Unpaid leave', toil: 'TOIL', other: 'Other',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

type Balance = {
  entitlement_value: number
  taken_value: number
  booked_value: number
  scheduled_value: number
  balance_remaining: number | null
  allocation_unit: string
} | null

type RotaDay = {
  date: string
  slots: Array<{
    slotId: string
    role: string
    shifts: Array<{ id: string; staffName: string | null; isRequester: boolean }>
  }>
}

type PrevRequest = {
  id: string
  type: string
  start_date: string
  end_date: string
  status: string
}

type CoverCandidate = { id: string; first_name: string; last_name: string }

export function LeaveApprovalClient({
  homeId, request, balance, previousRequests, rotaByDate, coverCandidates,
}: {
  homeId: string
  request: {
    id: string; type: string; start_date: string; end_date: string
    value_requested: number; status: string; staff_message: string | null; staffName: string
  }
  balance: Balance
  previousRequests: PrevRequest[]
  rotaByDate: RotaDay[]
  coverCandidates: CoverCandidate[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedCover, setSelectedCover] = useState<string>('')
  const [managerNote, setManagerNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const isPending = request.status === 'pending'
  const unit = balance?.allocation_unit === 'days' ? 'days' : 'hours'
  const wouldRemain = balance
    ? (balance.balance_remaining ?? (balance.entitlement_value - balance.taken_value - balance.booked_value)) - request.value_requested
    : null

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('manager_note', managerNote)
      if (selectedCover) fd.set('cover_staff_id', selectedCover)
      const result = await approveLeaveRequest(homeId, request.id, fd)
      if ('error' in result && result.error) {
        setError(result.error)
      } else {
        router.push(`/homes/${homeId}/leave`)
      }
    })
  }

  function handleReject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await rejectLeaveRequest(homeId, request.id, fd)
      if ('error' in result && result.error) {
        setError(result.error)
      } else {
        router.push(`/homes/${homeId}/leave`)
      }
    })
  }

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[60vh]">
      {/* ── Panel 1: Request detail ────────────────────────────── */}
      <div className="col-span-1 space-y-4">
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">Request</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Staff</dt>
              <dd className="font-medium">{request.staffName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{TYPE_LABELS[request.type] ?? request.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Dates</dt>
              <dd className="text-right text-xs">{fmtDate(request.start_date)} – {fmtDate(request.end_date)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Requested</dt>
              <dd className="font-semibold">{request.value_requested} {unit}</dd>
            </div>
          </dl>

          {request.staff_message && (
            <div className="pt-2 border-t text-xs text-muted-foreground italic">
              &ldquo;{request.staff_message}&rdquo;
            </div>
          )}
        </div>

        {/* Balance summary */}
        {balance && (
          <div className="bg-card border rounded-lg p-4 space-y-2">
            <h2 className="text-sm font-semibold">Leave balance</h2>
            <div className="text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Entitlement</span><span>{balance.entitlement_value} {unit}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Taken</span><span>{balance.taken_value} {unit}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Booked</span><span>{balance.booked_value} {unit}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Requested</span><span className="text-amber-600">{request.value_requested} {unit}</span></div>
              <div className="flex justify-between border-t pt-1 font-medium">
                <span>Would remain</span>
                <span className={wouldRemain !== null && wouldRemain < 0 ? 'text-destructive' : ''}>{wouldRemain?.toFixed(1) ?? '—'} {unit}</span>
              </div>
            </div>
            {wouldRemain !== null && wouldRemain < 0 && (
              <p className="text-xs text-destructive mt-1">⚠ This exceeds the remaining balance.</p>
            )}
          </div>
        )}

        {/* Previous requests */}
        {previousRequests.length > 0 && (
          <div className="bg-card border rounded-lg p-4 space-y-2">
            <h2 className="text-sm font-semibold">Last requests</h2>
            <div className="space-y-1 text-xs">
              {previousRequests.map(pr => (
                <div key={pr.id} className="flex justify-between text-muted-foreground">
                  <span>{TYPE_LABELS[pr.type] ?? pr.type} · {fmtDate(pr.start_date)}</span>
                  <span className={pr.status === 'approved' ? 'text-green-600' : pr.status === 'rejected' ? 'text-destructive' : ''}>{pr.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Panel 2: Rota context ──────────────────────────────── */}
      <div className="col-span-1 space-y-2">
        <h2 className="text-sm font-semibold mb-3">Rota context</h2>

        {rotaByDate.length === 0 && (
          <p className="text-xs text-muted-foreground">No published rota found for these dates.</p>
        )}

        {rotaByDate.map(day => (
          <div key={day.date} className="border rounded-lg p-3 bg-card text-xs">
            <div className="font-medium text-muted-foreground mb-2">{fmtDate(day.date)}</div>
            {day.slots.length === 0 ? (
              <p className="text-muted-foreground/70">No slots</p>
            ) : (
              day.slots.map(slot => (
                <div key={slot.slotId} className="mb-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{slot.role}</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {slot.shifts.map(sh => (
                      <span
                        key={sh.id}
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          sh.isRequester
                            ? 'bg-amber-100 text-amber-800 font-medium'
                            : sh.staffName
                              ? 'bg-green-50 text-green-800'
                              : 'bg-muted text-muted-foreground border border-dashed'
                        }`}
                      >
                        {sh.isRequester ? `⚠ ${sh.staffName ?? 'Requester'}` : sh.staffName ?? 'Open'}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {/* ── Panel 3: Actions ──────────────────────────────────── */}
      <div className="col-span-1 space-y-4">
        <h2 className="text-sm font-semibold">Cover & decision</h2>

        {!isPending && (
          <div className="bg-muted/30 border rounded-lg px-4 py-3 text-sm text-muted-foreground">
            This request has already been <strong>{request.status}</strong>.
          </div>
        )}

        {isPending && (
          <>
            {/* Cover selection */}
            <div className="bg-card border rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium">Cover staff (optional)</div>
              <select
                value={selectedCover}
                onChange={e => setSelectedCover(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-background"
              >
                <option value="">— Leave shifts open (auto-rebalancer) —</option>
                {coverCandidates.map(c => (
                  <option key={c.id} value={c.id}>{c.last_name}, {c.first_name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                If no cover is selected, affected published shifts are released and a rebalance suggestion is raised.
              </p>
            </div>

            {/* Manager note */}
            <div>
              <label className="block text-xs font-medium mb-1">Note to staff (optional)</label>
              <textarea
                value={managerNote}
                onChange={e => setManagerNote(e.target.value)}
                rows={2}
                placeholder="Any message for the staff member…"
                className="w-full border rounded px-3 py-1.5 text-sm resize-none"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={pending}
                className="flex-1 text-sm font-medium bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Approve'}
              </button>
              <button
                onClick={() => setShowRejectForm(v => !v)}
                disabled={pending}
                className="flex-1 text-sm font-medium border px-4 py-2 rounded-md hover:bg-muted/40 disabled:opacity-50"
              >
                Reject
              </button>
            </div>

            {showRejectForm && (
              <form onSubmit={handleReject} className="space-y-3 border rounded-lg p-4 bg-destructive/5">
                <div className="text-sm font-medium text-destructive">Reject request</div>
                <div>
                  <label className="block text-xs font-medium mb-1">Reason (shown to staff) *</label>
                  <textarea
                    name="manager_note"
                    required
                    rows={3}
                    placeholder="Explain why the request is being rejected…"
                    className="w-full border rounded px-3 py-1.5 text-sm resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full text-sm font-medium bg-destructive text-destructive-foreground px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {pending ? 'Rejecting…' : 'Confirm rejection'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
