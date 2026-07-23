'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange } from 'lucide-react'
import { createBaseWeekAction } from './actions'

export function CreateBaseWeekButton({ homeId, periodId }: { homeId: string; periodId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function run() {
    setMsg(null)
    startTransition(async () => {
      const r = await createBaseWeekAction(homeId, periodId)
      if (r.error && !r.success) { setMsg(`Error: ${r.error}`); return }
      setConfirming(false)
      setMsg(`Base week set from ${r.patterns} shifts · ${r.periodsCreated} weeks generated`)
      router.refresh()
    })
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => { setConfirming(true); setMsg(null) }}
          className="inline-flex items-center gap-1.5 text-sm font-medium border border-primary text-primary px-3 py-1.5 rounded-md hover:bg-primary/5"
        >
          <CalendarRange className="h-4 w-4" />
          Create base week
        </button>
        {msg && <span className="text-xs text-muted-foreground max-w-[18rem] text-right">{msg}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5 max-w-[20rem]">
      <p className="text-xs text-muted-foreground text-right">
        Use this week as the repeating base and generate the next 6 months from it? Existing repeating
        patterns are replaced. Leave and sickness are applied per week; each week stays editable.
      </p>
      <div className="flex gap-2">
        <button onClick={() => setConfirming(false)} disabled={pending} className="text-sm px-3 py-1.5 rounded border">Cancel</button>
        <button onClick={run} disabled={pending} className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
          {pending ? 'Generating 6 months…' : 'Create base week'}
        </button>
      </div>
      {msg && <span className="text-xs text-destructive text-right">{msg}</span>}
    </div>
  )
}
