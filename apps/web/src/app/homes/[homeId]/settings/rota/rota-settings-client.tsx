'use client'

import { useState, useTransition } from 'react'
import { saveRotaConfig, addSlotRequirement, deleteSlotRequirement } from './actions'

type Requirement = {
  id: string
  day_of_week: number
  role_code: string
  headcount_required: number
  shift_pattern_template_id: string
  shift_pattern_templates: { name: string } | null
}
type Pattern = { id: string; name: string }

export function RotaSettingsClient({
  homeId, periodWeeks, startDay, requirements, patterns, days,
}: {
  homeId: string
  periodWeeks: number
  startDay: number
  requirements: Requirement[]
  patterns: Pattern[]
  days: string[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  function handleConfig(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const r = await saveRotaConfig(homeId, fd)
      if (r.error) setError(r.error)
    })
  }

  function handleAddSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const r = await addSlotRequirement(homeId, fd)
      if (r.error) { setError(r.error); return }
      setShowAddForm(false)
      ;(e.target as HTMLFormElement).reset()
    })
  }

  function handleDeleteSlot(reqId: string) {
    startTransition(async () => { await deleteSlotRequirement(homeId, reqId) })
  }

  const grouped = requirements.reduce<Record<number, Requirement[]>>((acc, r) => {
    if (!acc[r.day_of_week]) acc[r.day_of_week] = []
    acc[r.day_of_week]!.push(r)
    return acc
  }, {})

  return (
    <div className="max-w-2xl space-y-8 mt-6">
      {/* Period config */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Period settings</h2>
        <form onSubmit={handleConfig} className="bg-card border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Period length</label>
              <select name="rota_period_weeks" defaultValue={periodWeeks} className="w-full border rounded px-3 py-1.5 text-sm bg-background">
                <option value={1}>1 week</option>
                <option value={2}>2 weeks</option>
                <option value={4}>4 weeks</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Rota starts on</label>
              <select name="rota_start_day" defaultValue={startDay} className="w-full border rounded px-3 py-1.5 text-sm bg-background">
                {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </section>

      {/* Standard week requirements */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Standard week — slot requirements
        </h2>
        <p className="text-xs text-muted-foreground">
          These define what shifts are created automatically when a new rota period is opened.
        </p>

        {Object.keys(grouped).length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground py-2">No slot requirements yet.</p>
        )}

        {[0, 1, 2, 3, 4, 5, 6].map(dow => {
          const reqs = grouped[dow]
          if (!reqs?.length) return null
          return (
            <div key={dow}>
              <div className="text-xs font-semibold text-muted-foreground mb-1">{days[dow]}</div>
              <div className="border rounded-lg divide-y">
                {reqs.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2 text-sm bg-card">
                    <span className="font-medium">{r.role_code}</span>
                    <span className="text-muted-foreground text-xs">{r.shift_pattern_templates?.name ?? '—'}</span>
                    <span className="text-muted-foreground text-xs">×{r.headcount_required}</span>
                    <button onClick={() => handleDeleteSlot(r.id)} disabled={pending} className="text-xs text-destructive hover:underline disabled:opacity-40">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {showAddForm ? (
          <form onSubmit={handleAddSlot} className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold">Add slot requirement</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Day *</label>
                <select name="day_of_week" required className="w-full border rounded px-3 py-1.5 text-sm bg-background">
                  {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Headcount *</label>
                <input name="headcount_required" type="number" min={1} max={20} defaultValue={1} required className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Shift pattern *</label>
                <select name="shift_pattern_template_id" required className="w-full border rounded px-3 py-1.5 text-sm bg-background">
                  <option value="">— select —</option>
                  {patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Role code *</label>
                <input name="role_code" required placeholder="CARE_ASST" className="w-full border rounded px-3 py-1.5 text-sm font-mono" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddForm(false)} className="text-sm px-3 py-1.5 rounded border">Cancel</button>
              <button type="submit" disabled={pending} className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
                {pending ? '…' : 'Add'}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowAddForm(true)} className="text-sm text-primary hover:underline font-medium">
            + Add slot requirement
          </button>
        )}

        {patterns.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">
            You need to create shift patterns first — go to Settings → Shift patterns.
          </p>
        )}
      </section>
    </div>
  )
}
