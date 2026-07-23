'use client'

import { useState, useTransition } from 'react'
import { markOverridesReviewed } from './actions'

type Props = {
  homeId: string
  overrideIds: string[]
  periodStart: string
  periodEnd: string
}

export function ReviewButton({ homeId, overrideIds, periodStart, periodEnd }: Props) {
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (done) {
    return (
      <span className="text-xs text-green-700 font-medium">
        ✓ Marked as reviewed
      </span>
    )
  }

  function handleClick() {
    setError(null)
    startTransition(async () => {
      try {
        await markOverridesReviewed(homeId, overrideIds, periodStart, periodEnd)
        setDone(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save review')
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={pending}
        className="btn-secondary text-xs"
      >
        {pending ? 'Saving…' : `Mark ${overrideIds.length} as reviewed`}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
