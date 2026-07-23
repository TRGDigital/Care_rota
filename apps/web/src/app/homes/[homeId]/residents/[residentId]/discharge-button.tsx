'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { dischargeResident } from '../actions'

type Props = { homeId: string; residentId: string }

export function DischargeButton({ homeId, residentId }: Props) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    startTransition(async () => {
      await dischargeResident(homeId, residentId, date)
      setOpen(false)
      router.push(`/homes/${homeId}/residents`)
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary text-sm text-destructive border-destructive/30 hover:bg-destructive/5">
        Record discharge
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-card border shadow-lg p-6 space-y-4">
            <h2 className="text-base font-semibold">Record discharge</h2>
            <p className="text-sm text-muted-foreground">
              The resident will move to Past Residents. All assessments and history are retained.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Discharge date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input-base"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={pending} className="btn-primary flex-1 bg-destructive hover:bg-destructive/90">
                {pending ? 'Recording…' : 'Confirm discharge'}
              </button>
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
