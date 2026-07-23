'use client'

import { useState, useTransition } from 'react'
import { formatPence } from '@/lib/utils'

type ProposedCut = {
  shiftId: string
  staffName: string
  shiftDate: string
  shiftBlock: string
  savingsPence: number
  reason: string
}

type Props = {
  homeId: string
  occupiedBeds: number
  proposedCuts: ProposedCut[]
  totalSavingsPence: number
}

export function CostGuardPanel({ homeId, occupiedBeds, proposedCuts, totalSavingsPence }: Props) {
  const [approved, setApproved] = useState<Set<string>>(new Set(proposedCuts.map(c => c.shiftId)))
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Cuts approved — rota updated and savings logged.
      </div>
    )
  }

  const approvedCuts = proposedCuts.filter(c => approved.has(c.shiftId))
  const approvedSavings = approvedCuts.reduce((s, c) => s + c.savingsPence, 0)

  function toggle(id: string) {
    setApproved(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleApprove() {
    if (!approvedCuts.length) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/cost-guard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ homeId, approvedShiftIds: [...approved] }),
        })
        if (!res.ok) throw new Error(await res.text())
        setDone(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approval failed')
      }
    })
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-blue-900">
          Cost guard: occupancy at {occupiedBeds} beds
        </p>
        <p className="text-xs text-blue-700 mt-0.5">
          Your staffing matrix suggests the following shifts can be removed.
          Approve all or deselect any you want to keep.
        </p>
      </div>

      <ul className="space-y-1.5">
        {proposedCuts.map(cut => {
          const selected = approved.has(cut.shiftId)
          return (
            <li
              key={cut.shiftId}
              className={`flex items-center gap-3 rounded px-3 py-2 text-sm cursor-pointer transition-colors ${
                selected ? 'bg-blue-100' : 'bg-white/60 line-through text-blue-400'
              }`}
              onClick={() => toggle(cut.shiftId)}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(cut.shiftId)}
                className="h-4 w-4 rounded border-blue-300"
                onClick={e => e.stopPropagation()}
              />
              <span className="flex-1">
                <span className="font-medium capitalize">{cut.shiftDate}</span>
                {' — '}
                <span className="capitalize">{cut.shiftBlock}</span>
                {' shift'}
              </span>
              <span className="tabular-nums font-medium text-blue-800">
                saves {formatPence(cut.savingsPence)}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between pt-1">
        <p className="text-sm font-semibold text-blue-900">
          Total saving: {formatPence(approvedSavings)}
        </p>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-destructive">{error}</span>}
          <button
            onClick={handleApprove}
            disabled={pending || approvedCuts.length === 0}
            className="btn-primary text-sm"
          >
            {pending ? 'Approving…' : `Approve ${approvedCuts.length} cut${approvedCuts.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
