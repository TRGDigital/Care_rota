'use client'

import { useTransition } from 'react'
import { createPeriodAction } from './actions'

export function CreatePeriodButton({ homeId, disabled }: { homeId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => startTransition(async () => { await createPeriodAction(homeId) })}
        disabled={disabled || pending}
        className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create next period'}
      </button>
      {disabled && !pending && (
        <span className="text-xs text-muted-foreground">A draft period already exists</span>
      )}
    </div>
  )
}
