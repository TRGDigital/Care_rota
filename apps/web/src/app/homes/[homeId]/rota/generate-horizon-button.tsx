'use client'

import { useState, useTransition } from 'react'
import { generateHorizonAction } from './actions'

export function GenerateHorizonButton({ homeId }: { homeId: string }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => startTransition(async () => {
          setMsg(null)
          const r = await generateHorizonAction(homeId)
          if (r.error) setMsg(`Error: ${r.error}`)
          else setMsg(`Generated ${r.periodsCreated} periods · ${(r.shiftsPreFilled ?? 0) + (r.shiftsAssigned ?? 0)} shifts placed`)
        })}
        disabled={pending}
        className="text-sm font-medium border border-primary text-primary px-3 py-1.5 rounded-md hover:bg-primary/5 disabled:opacity-50"
      >
        {pending ? 'Generating 6 months…' : 'Generate 6 months'}
      </button>
      {msg && <span className="text-xs text-muted-foreground max-w-[16rem] text-right">{msg}</span>}
    </div>
  )
}
