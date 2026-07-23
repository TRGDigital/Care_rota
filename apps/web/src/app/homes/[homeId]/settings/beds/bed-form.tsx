'use client'

import { useState, useTransition } from 'react'
import { addBed, editBed } from './actions'

type Mode = 'add' | 'edit'
type Props = {
  homeId: string
  mode: Mode
  bedId?: string
  defaultValues?: { room_number: string; capacity: number; status: string }
  children: React.ReactNode
}

export function BedForm({ homeId, mode, bedId, defaultValues, children }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        if (mode === 'add') await addBed(homeId, fd)
        else if (bedId) await editBed(homeId, bedId, fd)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-card border shadow-lg p-6 space-y-4">
            <h2 className="text-base font-semibold">{mode === 'add' ? 'Add bed' : 'Edit bed'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Room number *</label>
                <input name="room_number" required defaultValue={defaultValues?.room_number ?? ''} className="input-base w-24" placeholder="14" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Capacity</label>
                <select name="capacity" defaultValue={defaultValues?.capacity ?? 1} className="input-base">
                  <option value={1}>Single</option>
                  <option value={2}>Double</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select name="status" defaultValue={defaultValues?.status ?? 'vacant'} className="input-base">
                  <option value="vacant">Vacant</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pending} className="btn-primary flex-1">{pending ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
