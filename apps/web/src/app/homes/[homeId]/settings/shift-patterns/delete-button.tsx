'use client'

import { useTransition } from 'react'
import { deleteShiftPattern } from './actions'

export function DeletePatternButton({ homeId, patternId }: { homeId: string; patternId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(async () => { await deleteShiftPattern(homeId, patternId) })}
      disabled={pending}
      className="text-xs text-destructive hover:underline disabled:opacity-40"
    >
      {pending ? '…' : 'Delete'}
    </button>
  )
}
