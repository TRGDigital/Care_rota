'use client'

import { useRef, useState, useTransition } from 'react'
import { createShiftPattern } from './actions'

type Props = { homeId: string }

export function ShiftPatternForm({ homeId }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await createShiftPattern(homeId, fd)
      if (result.error) { setError(result.error); return }
      formRef.current?.reset()
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        + Add pattern
      </button>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-card border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold">New shift pattern</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1">Name</label>
          <input name="name" required placeholder="e.g. Day 07:00–19:00" className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Start time</label>
          <input name="start_time_local" type="time" required className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">End time</label>
          <input name="end_time_local" type="time" required className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Break (minutes)</label>
          <input name="break_minutes" type="number" min={0} max={120} defaultValue={60} required className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Paid hours</label>
          <input name="paid_hours_decimal" type="number" step="0.25" min={0} max={24} required className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1">Type</label>
          <select name="length_type" className="w-full border rounded px-3 py-1.5 text-sm bg-background">
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
  )
}
