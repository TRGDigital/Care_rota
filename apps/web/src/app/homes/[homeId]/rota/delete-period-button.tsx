'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deletePeriodAction } from './actions'

export function DeletePeriodButton({ homeId, periodId }: { homeId: string; periodId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onDelete() {
    setBusy(true); setErr(null)
    const r = await deletePeriodAction(homeId, periodId)
    setBusy(false)
    if (r.error) setErr(r.error)
    else router.refresh()
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} title="Delete draft"
        className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600">
        <Trash2 size={15} />
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {err && <span className="text-xs text-red-600">{err}</span>}
      <button onClick={onDelete} disabled={busy} className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
        {busy ? 'Deleting…' : 'Delete'}
      </button>
      <button onClick={() => { setConfirming(false); setErr(null) }} className="rounded border px-2 py-1 text-xs text-muted-foreground">Cancel</button>
    </div>
  )
}
