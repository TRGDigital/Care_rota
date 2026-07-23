'use client'

import { useRef, useState, useTransition } from 'react'
import { createShiftPattern, updateShiftPattern } from './actions'

export type Pattern = {
  id: string
  name: string
  start_time_local: string
  end_time_local: string
  break_minutes: number
  paid_hours_decimal: number
  length_type: string
}

// Handles both adding a new pattern and editing an existing one. Pass `pattern` to edit; pass
// `children` to supply a custom trigger (e.g. the row's Edit button).
export function ShiftPatternForm({ homeId, pattern, children }: {
  homeId: string
  pattern?: Pattern
  children?: React.ReactNode
}) {
  const isEdit = !!pattern
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = isEdit ? await updateShiftPattern(homeId, pattern!.id, fd) : await createShiftPattern(homeId, fd)
      if (result.error) { setError(result.error); return }
      if (!isEdit) formRef.current?.reset()
      setOpen(false)
    })
  }

  const hhmm = (t?: string) => (t ? t.slice(0, 5) : '')

  if (!open) {
    if (isEdit) {
      return (
        <button onClick={() => setOpen(true)} className="text-xs text-primary hover:underline">
          {children ?? 'Edit'}
        </button>
      )
    }
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        + Add pattern
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setOpen(false)}>
    <form ref={formRef} onSubmit={handleSubmit} onClick={e => e.stopPropagation()} className="mt-16 w-full max-w-md bg-card border rounded-lg p-4 space-y-3 shadow-xl text-left">
      <h3 className="text-sm font-semibold">{isEdit ? 'Edit shift pattern' : 'New shift pattern'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1">Name</label>
          <input name="name" required defaultValue={pattern?.name} placeholder="e.g. Long day 07:30–19:30" className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Start time</label>
          <input name="start_time_local" type="time" required defaultValue={hhmm(pattern?.start_time_local)} className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">End time</label>
          <input name="end_time_local" type="time" required defaultValue={hhmm(pattern?.end_time_local)} className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Break (minutes)</label>
          <input name="break_minutes" type="number" min={0} max={120} defaultValue={pattern?.break_minutes ?? 60} required className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Paid hours</label>
          <input name="paid_hours_decimal" type="number" step="0.25" min={0} max={24} defaultValue={pattern?.paid_hours_decimal} required className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1">Type</label>
          <select name="length_type" defaultValue={pattern?.length_type ?? 'custom'} className="w-full border rounded px-3 py-1.5 text-sm bg-background">
            <option value="long_day_12h">Long day (12h)</option>
            <option value="short_half_6h">Short / half day (6h)</option>
            <option value="sleep_in">Sleep-in</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="text-sm px-3 py-1.5 rounded border">Cancel</button>
        <button type="submit" disabled={pending} className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
    </div>
  )
}
