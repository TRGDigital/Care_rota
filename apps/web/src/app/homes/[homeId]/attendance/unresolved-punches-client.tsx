'use client'

import { useState, useTransition } from 'react'
import { Button } from '@carerota/ui'
import { AlertCircle, Clock, User, CheckCircle, RefreshCw } from 'lucide-react'
import { resolveNoShow, resolveNoClockOut } from './actions'

type Row = {
  id: string
  reconciliation_status: string
  actual_start_utc: string | null
  shift_id: string
  shifts: {
    planned_start_utc: string
    planned_end_utc: string
    shift_slots: {
      shift_pattern_templates: { name: string; break_minutes: number } | null
    } | null
  } | null
  staff: {
    id: string
    first_name: string
    last_name: string
    employee_number: string | null
    photo_url: string | null
  } | null
}

export function UnresolvedPunchesClient({
  homeId,
  rows: initialRows,
}: {
  homeId: string
  rows: Row[]
}) {
  const [rows, setRows] = useState(initialRows)
  const [resolving, setResolving] = useState<string | null>(null)

  function remove(id: string) {
    setRows(r => r.filter(x => x.id !== id))
  }

  if (rows.length === 0) {
    return (
      <div className="mt-8 text-center py-12 border rounded-lg text-sm text-muted-foreground">
        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
        No unresolved punches — all shifts are reconciled.
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-3">
      {rows.map(row => (
        <PunchCard
          key={row.id}
          homeId={homeId}
          row={row}
          isResolving={resolving === row.id}
          onStart={() => setResolving(row.id)}
          onDone={() => { setResolving(null); remove(row.id) }}
          onCancel={() => setResolving(null)}
        />
      ))}
    </div>
  )
}

function PunchCard({
  homeId,
  row,
  isResolving,
  onStart,
  onDone,
  onCancel,
}: {
  homeId: string
  row: Row
  isResolving: boolean
  onStart: () => void
  onDone: () => void
  onCancel: () => void
}) {
  const [action, setAction]       = useState<'pay_actual' | 'manual_out' | 'pay_zero' | 'pay_planned' | null>(null)
  const [clockOutTime, setClockOutTime] = useState('')
  const [reason, setReason]       = useState('')
  const [error, setError]         = useState('')
  const [isPending, startTransition] = useTransition()

  const isNoShow  = row.reconciliation_status === 'no_show'
  const isNoOut   = row.reconciliation_status === 'no_clock_out'
  const staff     = row.staff
  const shift     = row.shifts

  const templateName = shift?.shift_slots?.shift_pattern_templates?.name ?? null
  const plannedStart = shift?.planned_start_utc
    ? new Date(shift.planned_start_utc).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
    : '—'
  const plannedEnd = shift?.planned_end_utc
    ? new Date(shift.planned_end_utc).toLocaleTimeString('en-GB', { timeStyle: 'short' })
    : '—'

  function handleResolve() {
    if (!action) return
    if (!reason.trim()) { setError('A reason is required'); return }
    if (action === 'manual_out' && !clockOutTime) { setError('Enter the clock-out time'); return }

    setError('')
    startTransition(async () => {
      let result: { error?: string }
      if (isNoShow) {
        result = await resolveNoShow(homeId, row.id, { action: action as 'pay_zero' | 'pay_planned', reason })
      } else {
        const coTime = action === 'manual_out' ? new Date(clockOutTime).toISOString() : undefined
        result = await resolveNoClockOut(homeId, row.id, coTime
          ? { action: action as 'pay_actual' | 'manual_out' | 'pay_zero' | 'pay_planned', clockOutUtc: coTime, reason }
          : { action: action as 'pay_actual' | 'manual_out' | 'pay_zero' | 'pay_planned', reason },
        )
      }
      if (result.error) { setError(result.error); return }
      onDone()
    })
  }

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-5 w-5 shrink-0 ${isNoShow ? 'text-red-500' : 'text-amber-500'}`}>
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown staff'}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              isNoShow
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {isNoShow ? 'No show' : 'No clock-out'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Planned {plannedStart} – {plannedEnd}
            </span>
            {templateName && (
              <span className="ml-2">{templateName}</span>
            )}
          </div>
          {isNoOut && row.actual_start_utc && (
            <div className="text-xs text-muted-foreground">
              Clocked in at {new Date(row.actual_start_utc).toLocaleTimeString('en-GB', { timeStyle: 'short' })}
            </div>
          )}
        </div>
        {!isResolving && (
          <Button size="sm" variant="outline" onClick={onStart}>Resolve</Button>
        )}
      </div>

      {isResolving && (
        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resolution</p>

          <div className="space-y-1.5">
            {isNoShow && (
              <>
                <RadioOpt id="pz" label="Pay zero — confirmed no-show" checked={action === 'pay_zero'} onChange={() => setAction('pay_zero')} />
                <RadioOpt id="pp" label="Pay planned — exceptional approval required" checked={action === 'pay_planned'} onChange={() => setAction('pay_planned')} />
              </>
            )}
            {isNoOut && (
              <>
                <RadioOpt id="pa" label="Pay actual as recorded (use shift-end as clock-out)" checked={action === 'pay_actual'} onChange={() => setAction('pay_actual')} />
                <RadioOpt id="mo" label="Set clock-out manually" checked={action === 'manual_out'} onChange={() => setAction('manual_out')} />
                <RadioOpt id="pz2" label="Pay zero — confirmed no-show" checked={action === 'pay_zero'} onChange={() => setAction('pay_zero')} />
                <RadioOpt id="pp2" label="Pay planned — exceptional approval" checked={action === 'pay_planned'} onChange={() => setAction('pay_planned')} />
              </>
            )}
          </div>

          {action === 'manual_out' && (
            <div>
              <label className="text-xs font-medium">Clock-out time</label>
              <input
                type="datetime-local"
                value={clockOutTime}
                onChange={e => setClockOutTime(e.target.value)}
                className="block mt-1 border rounded px-2 py-1 text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium">Reason (required)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Brief explanation for audit record..."
              className="block mt-1 w-full border rounded px-2 py-1.5 text-sm resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleResolve} disabled={!action || isPending}>
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-1" />}
              Confirm resolution
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function RadioOpt({ id, label, checked, onChange }: {
  id: string; label: string; checked: boolean; onChange: () => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
      <input type="radio" id={id} checked={checked} onChange={onChange} className="h-3.5 w-3.5" />
      <span className="text-sm">{label}</span>
    </label>
  )
}
