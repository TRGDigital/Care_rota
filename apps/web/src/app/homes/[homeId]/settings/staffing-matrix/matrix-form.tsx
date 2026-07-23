'use client'

import { useState, useTransition } from 'react'
import { addMatrixRow, editMatrixRow } from './actions'

type Mode = 'add' | 'edit'
type DefaultValues = {
  shift_block: string
  name: string
  min_carers: number
  min_senior_carers: number
  min_nurses: number
  min_ancillary: number
}
type Props = {
  homeId: string
  mode: Mode
  matrixId?: string
  defaultValues?: DefaultValues
  children: React.ReactNode
}

export function MatrixForm({ homeId, mode, matrixId, defaultValues, children }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        if (mode === 'add') await addMatrixRow(homeId, fd)
        else if (matrixId) await editMatrixRow(homeId, matrixId, fd)
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
          <div className="w-full max-w-md rounded-lg bg-card border shadow-lg p-6 space-y-4">
            <h2 className="text-base font-semibold">
              {mode === 'add' ? 'Add matrix row' : 'Edit matrix row'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Shift block *</label>
                  <select
                    name="shift_block"
                    required
                    defaultValue={defaultValues?.shift_block ?? 'morning'}
                    className="input-base"
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="night">Night</option>
                    <option value="long_day">Long day</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Name *</label>
                  <input
                    name="name"
                    required
                    defaultValue={defaultValues?.name ?? ''}
                    className="input-base"
                    placeholder="e.g. Standard morning"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground pt-1">Minimum headcount per role</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Carers</label>
                  <input
                    name="min_carers"
                    type="number"
                    min={0}
                    defaultValue={defaultValues?.min_carers ?? 0}
                    className="input-base"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Senior carers</label>
                  <input
                    name="min_senior_carers"
                    type="number"
                    min={0}
                    defaultValue={defaultValues?.min_senior_carers ?? 0}
                    className="input-base"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nurses</label>
                  <input
                    name="min_nurses"
                    type="number"
                    min={0}
                    defaultValue={defaultValues?.min_nurses ?? 0}
                    className="input-base"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ancillary</label>
                  <input
                    name="min_ancillary"
                    type="number"
                    min={0}
                    defaultValue={defaultValues?.min_ancillary ?? 0}
                    className="input-base"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pending} className="btn-primary flex-1">
                  {pending ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
