'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, X, Check } from 'lucide-react'
import { aiRecommendAction, applyRotaSuggestionAction } from './actions'

type SuggestionChange = { type: 'reassign'; shift_id: string; to_staff_id: string }
type Suggestion = {
  title: string
  detail: string
  category: 'reduce_overtime' | 'utilise_pm' | 'coverage' | 'fairness' | 'other'
  estimated_saving_pence: number
  affected: string[]
  change?: SuggestionChange
}
type ApplyState = { status: 'idle' | 'applying' | 'applied' | 'error'; msg?: string }
type Snapshot = { totals: { overtime_hours: number; overtime_cost_pence: number; total_cost_pence: number; unfilled_shifts: number } }

const CATEGORY: Record<Suggestion['category'], { label: string; cls: string }> = {
  reduce_overtime: { label: 'Cut overtime', cls: 'bg-amber-100 text-amber-800' },
  utilise_pm:      { label: 'Use PM shift', cls: 'bg-teal-100 text-teal-800' },
  coverage:        { label: 'Coverage', cls: 'bg-sky-100 text-sky-800' },
  fairness:        { label: 'Fairness', cls: 'bg-purple-100 text-purple-800' },
  other:           { label: 'Other', cls: 'bg-muted text-muted-foreground' },
}

const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export function AiRecommendButton({ homeId, periodId }: { homeId: string; periodId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [applyState, setApplyState] = useState<Record<number, ApplyState>>({})

  function run() {
    setOpen(true); setError(null); setSuggestions(null); setSnapshot(null); setApplyState({})
    startTransition(async () => {
      const r = await aiRecommendAction(homeId, periodId)
      if (r.error || !r.success) { setError(r.error ?? 'Failed'); return }
      setSuggestions(r.suggestions as Suggestion[])
      setSnapshot(r.snapshot as Snapshot)
    })
  }

  function apply(i: number, change: SuggestionChange) {
    setApplyState(prev => ({ ...prev, [i]: { status: 'applying' } }))
    startTransition(async () => {
      const r = await applyRotaSuggestionAction(homeId, periodId, change)
      if (r.error || !r.success) {
        setApplyState(prev => ({ ...prev, [i]: { status: 'error', msg: r.error ?? 'Failed' } }))
        return
      }
      setApplyState(prev => ({ ...prev, [i]: { status: 'applied', msg: r.warning ? `Applied (warning: ${r.warning})` : `Moved to ${r.movedTo}` } }))
      router.refresh() // update the grid + summary behind the modal
    })
  }

  const totalSaving = (suggestions ?? []).reduce((n, s) => n + (s.estimated_saving_pence || 0), 0)

  return (
    <>
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {pending ? 'Analysing…' : 'AI recommends'}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full my-8">
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-600" /> AI rota review
                </h2>
                {snapshot && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Current overtime: <span className="font-semibold text-amber-700">{snapshot.totals.overtime_hours}h · {gbp(snapshot.totals.overtime_cost_pence)}</span>
                    {snapshot.totals.unfilled_shifts > 0 && <> · {snapshot.totals.unfilled_shifts} unfilled</>}
                  </p>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 space-y-3">
              {pending && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 animate-pulse text-violet-500" />
                  Analysing the allocation against the rules…
                </div>
              )}

              {error && !pending && (
                <div className="p-3 rounded bg-destructive/10 text-sm text-destructive">{error}</div>
              )}

              {suggestions && !pending && suggestions.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">No changes suggested — this rota looks efficient against overtime and PM usage.</p>
              )}

              {suggestions && suggestions.length > 0 && (
                <>
                  {totalSaving > 0 && (
                    <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
                      Potential saving across all suggestions: <span className="font-bold">{gbp(totalSaving)}</span>
                    </div>
                  )}
                  <ol className="space-y-3">
                    {suggestions.map((s, i) => {
                      const cat = CATEGORY[s.category]
                      const st = applyState[i]
                      return (
                        <li key={i} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                              <span className="font-medium text-sm">{s.title}</span>
                            </div>
                            {s.estimated_saving_pence > 0 && (
                              <span className="shrink-0 text-sm font-bold text-emerald-700 tabular-nums">{gbp(s.estimated_saving_pence)}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1.5 ml-7">{s.detail}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-7">
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${cat.cls}`}>{cat.label}</span>
                            {s.affected.map((a, j) => (
                              <span key={j} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a}</span>
                            ))}
                          </div>
                          {/* One-click apply — only for suggestions with a concrete, validated change */}
                          {s.change && (
                            <div className="mt-2.5 ml-7 flex items-center gap-2">
                              {st?.status === 'applied' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                  <Check className="h-3.5 w-3.5" /> {st.msg}
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => apply(i, s.change!)}
                                    disabled={pending || st?.status === 'applying'}
                                    className="text-xs font-medium bg-foreground text-background px-2.5 py-1 rounded-md hover:opacity-90 disabled:opacity-50"
                                  >
                                    {st?.status === 'applying' ? 'Applying…' : 'Apply this change'}
                                  </button>
                                  {st?.status === 'error' && <span className="text-xs text-destructive">{st.msg}</span>}
                                </>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Read-only suggestions. Figures are estimated from the current allocation — review against the hard rules (rest, working-time, training) before making changes.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
