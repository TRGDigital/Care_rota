'use client'

import { useState, useTransition } from 'react'
import { saveRotaConfig, addSlotRequirement, deleteSlotRequirement } from './actions'

type Requirement = {
  id: string
  day_of_week: number | null
  role_code: string
  headcount_required: number
  shift_pattern_template_id: string
  shift_pattern_templates: { name: string } | null
}
type Pattern = { id: string; name: string; start: string; end: string; hours: number }
type Position = { code: string; name: string }

export function RotaSettingsClient({
  homeId, periodWeeks, startDay, requirements, patterns, positions, days,
}: {
  homeId: string
  periodWeeks: number
  startDay: number
  requirements: Requirement[]
  patterns: Pattern[]
  positions: Position[]
  days: string[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [scope, setScope] = useState<'all' | 'day'>('all')

  const patternById = new Map(patterns.map(p => [p.id, p]))
  const roleName = (code: string) => positions.find(p => p.code === code)?.name ?? code

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
    const form = e.currentTarget
    const fd = new FormData(form)
    if (scope === 'all') fd.set('day_of_week', 'all')
    setError(null)
    startTransition(async () => {
      const r = await addSlotRequirement(homeId, fd)
      if (r.error) { setError(r.error); return }
      setShowAddForm(false)
      form.reset()
      setScope('all')
    })
  }

  function handleDeleteSlot(reqId: string) {
    startTransition(async () => { await deleteSlotRequirement(homeId, reqId) })
  }

  const everyDay = requirements.filter(r => r.day_of_week === null)
  const perDay = requirements.filter(r => r.day_of_week !== null)
  const groupedPerDay = perDay.reduce<Record<number, Requirement[]>>((acc, r) => {
    const d = r.day_of_week as number
    if (!acc[d]) acc[d] = []
    acc[d]!.push(r)
    return acc
  }, {})

  // Planned paid hours per week = for each rule, headcount × pattern hours × (days it applies).
  const hoursOf = (r: Requirement) => (patternById.get(r.shift_pattern_template_id)?.hours ?? 0) * r.headcount_required
  const weeklyPlanned =
    everyDay.reduce((n, r) => n + hoursOf(r) * 7, 0) +
    perDay.reduce((n, r) => n + hoursOf(r), 0)

  function RuleRow({ r }: { r: Requirement }) {
    const p = patternById.get(r.shift_pattern_template_id)
    return (
      <div className="flex items-center gap-3 px-4 py-2 text-sm bg-card">
        <span className="font-medium w-40 shrink-0">{roleName(r.role_code)}</span>
        <span className="text-muted-foreground text-xs flex-1">
          {p ? `${p.name} · ${p.start}–${p.end} · ${p.hours}h` : (r.shift_pattern_templates?.name ?? '—')}
        </span>
        <span className="text-xs font-medium tabular-nums">×{r.headcount_required}</span>
        <button onClick={() => handleDeleteSlot(r.id)} disabled={pending} className="text-xs text-destructive hover:underline disabled:opacity-40">Remove</button>
      </div>
    )
  }

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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Standard week — staffing rules
          </h2>
          {requirements.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Planned <span className="font-semibold text-foreground tabular-nums">{Math.round(weeklyPlanned * 10) / 10}h</span>/week
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          These define what shifts are created when a new rota period opens. An <span className="font-medium">every-day</span> rule
          (e.g. 4 Care Assistants on a full day) becomes one line for the whole week — no need to repeat it per day.
          Add a <span className="font-medium">specific-day</span> rule only where a day genuinely differs.
        </p>

        {requirements.length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground py-2">No staffing rules yet.</p>
        )}

        {/* Every-day rules */}
        {everyDay.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-emerald-700 mb-1">Every day</div>
            <div className="border rounded-lg divide-y">
              {everyDay.map(r => <RuleRow key={r.id} r={r} />)}
            </div>
          </div>
        )}

        {/* Specific-day rules */}
        {[0, 1, 2, 3, 4, 5, 6].map(dow => {
          const reqs = groupedPerDay[dow]
          if (!reqs?.length) return null
          return (
            <div key={dow}>
              <div className="text-xs font-semibold text-muted-foreground mb-1">{days[dow]} only</div>
              <div className="border rounded-lg divide-y">
                {reqs.map(r => <RuleRow key={r.id} r={r} />)}
              </div>
            </div>
          )
        })}

        {showAddForm ? (
          <form onSubmit={handleAddSlot} className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold">Add staffing rule</h3>

            {/* Scope toggle */}
            <div>
              <label className="block text-xs font-medium mb-1">Applies to</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setScope('all')}
                  className={`text-sm px-3 py-1.5 rounded border ${scope === 'all' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background'}`}>
                  Every day
                </button>
                <button type="button" onClick={() => setScope('day')}
                  className={`text-sm px-3 py-1.5 rounded border ${scope === 'day' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}>
                  A specific day
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {scope === 'day' && (
                <div>
                  <label className="block text-xs font-medium mb-1">Day *</label>
                  <select name="day_of_week" required className="w-full border rounded px-3 py-1.5 text-sm bg-background">
                    {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1">Role *</label>
                <select name="role_code" required defaultValue="care_assistant" className="w-full border rounded px-3 py-1.5 text-sm bg-background">
                  {positions.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Shift pattern *</label>
                <select name="shift_pattern_template_id" required className="w-full border rounded px-3 py-1.5 text-sm bg-background">
                  <option value="">— select —</option>
                  {patterns.map(p => <option key={p.id} value={p.id}>{p.name} ({p.start}–{p.end}, {p.hours}h)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">How many *</label>
                <input name="headcount_required" type="number" min={1} max={20} defaultValue={1} required className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowAddForm(false); setError(null) }} className="text-sm px-3 py-1.5 rounded border">Cancel</button>
              <button type="submit" disabled={pending} className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
                {pending ? '…' : 'Add rule'}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => { setShowAddForm(true); setScope('all') }} className="text-sm text-primary hover:underline font-medium">
            + Add staffing rule
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
