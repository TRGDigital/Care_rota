'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveBedCapacity } from './capacity-actions'

export function BedCapacityInput({ homeId, value }: { homeId: string; value: number }) {
  const router = useRouter()
  const [capacity, setCapacity] = useState(value)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function save() {
    if (capacity === value) return
    setMsg(null)
    startTransition(async () => {
      const r = await saveBedCapacity(homeId, capacity)
      if (r.error) setMsg(r.error)
      else { setMsg('Saved'); router.refresh(); setTimeout(() => setMsg(null), 1500) }
    })
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <label className="block text-sm font-medium mb-1">Total beds (capacity)</label>
      <p className="text-xs text-muted-foreground mb-3">
        The number of beds in this home. Used to work out occupancy. You don&rsquo;t need to add each bed individually.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={2000}
          value={capacity}
          onChange={e => setCapacity(Math.max(0, Number(e.target.value)))}
          className="w-28 border rounded px-3 py-1.5 text-sm bg-background"
        />
        <button
          onClick={save}
          disabled={pending || capacity === value}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  )
}
