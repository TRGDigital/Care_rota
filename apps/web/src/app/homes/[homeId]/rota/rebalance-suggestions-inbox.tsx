'use client'

import { useState, useTransition } from 'react'
import { dismissSuggestion, approveSuggestion } from './rebalance-actions'

const TRIGGER_LABELS: Record<string, string> = {
  leave_approved: 'Leave approved',
  sickness_reported: 'Sickness',
  training_expired: 'Training expiry',
  occupancy_drop: 'Occupancy drop',
  occupancy_rise: 'Occupancy rise',
  no_show: 'No-show',
}

type Suggestion = {
  id: string
  trigger_type: string
  summary: string
  cost_impact_pence: number
  created_at: string
  status: string
}

function pence(v: number) {
  if (v === 0) return '£0'
  const sign = v < 0 ? '-' : '+'
  return `${sign}£${(Math.abs(v) / 100).toFixed(2)}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function RebalanceSuggestionsInbox({
  homeId,
  suggestions: initialSuggestions,
}: {
  homeId: string
  suggestions: Suggestion[]
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      const result = await dismissSuggestion(homeId, id, 'Dismissed by manager')
      if ('error' in result && result.error) {
        showToast(`Error: ${result.error}`)
      } else {
        setSuggestions(prev => prev.filter(s => s.id !== id))
        showToast('Dismissed')
      }
    })
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveSuggestion(homeId, id)
      if ('error' in result && result.error) {
        showToast(`Error: ${result.error}`)
      } else {
        setSuggestions(prev => prev.filter(s => s.id !== id))
        showToast('Approved')
      }
    })
  }

  return (
    <div className="bg-card border rounded-lg p-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <h3 className="text-sm font-semibold mb-3">
        Rebalance suggestions
        {suggestions.length > 0 && (
          <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
            {suggestions.length}
          </span>
        )}
      </h3>

      {suggestions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No open suggestions.</p>
      ) : (
        <div className="space-y-3">
          {suggestions.map(s => (
            <div key={s.id} className="border rounded-lg p-3 bg-background space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">
                    {TRIGGER_LABELS[s.trigger_type] ?? s.trigger_type}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">{fmtDate(s.created_at)}</span>
                </div>
                {s.cost_impact_pence !== 0 && (
                  <span className={`text-xs font-medium ${s.cost_impact_pence < 0 ? 'text-green-700' : 'text-amber-700'}`}>
                    {pence(s.cost_impact_pence)}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{s.summary}</p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleApprove(s.id)}
                  disabled={pending}
                  className="flex-1 text-xs py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDismiss(s.id)}
                  disabled={pending}
                  className="flex-1 text-xs py-1 rounded border hover:bg-muted/40 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
