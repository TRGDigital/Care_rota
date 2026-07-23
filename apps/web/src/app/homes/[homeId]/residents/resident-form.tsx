'use client'

import { useState, useTransition } from 'react'
import { addResident, editResident } from './actions'

type Mode = 'add' | 'edit'

type Props = {
  homeId: string
  mode: Mode
  residentId?: string
  defaultValues?: {
    first_name: string
    last_name_initial?: string | null
    room_number?: string | null
    admission_date?: string | null
    notes?: string | null
  }
  children: React.ReactNode
}

export function ResidentForm({ homeId, mode, residentId, defaultValues, children }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        if (mode === 'add') {
          await addResident(homeId, fd)
        } else if (residentId) {
          await editResident(homeId, residentId, fd)
        }
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
            <h2 className="text-base font-semibold">{mode === 'add' ? 'Add resident' : 'Edit resident'}</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="First name *">
                <input
                  name="first_name"
                  required
                  defaultValue={defaultValues?.first_name ?? ''}
                  className="input-base"
                  placeholder="e.g. Margaret"
                />
              </Field>
              <Field label="Last name initial">
                <input
                  name="last_name_initial"
                  maxLength={1}
                  defaultValue={defaultValues?.last_name_initial ?? ''}
                  className="input-base w-16"
                  placeholder="S"
                />
              </Field>
              <Field label="Room number">
                <input
                  name="room_number"
                  defaultValue={defaultValues?.room_number ?? ''}
                  className="input-base w-24"
                  placeholder="14"
                />
              </Field>
              <Field label="Admission date">
                <input
                  type="date"
                  name="admission_date"
                  defaultValue={defaultValues?.admission_date ?? ''}
                  className="input-base"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={defaultValues?.notes ?? ''}
                  className="input-base resize-none"
                  placeholder="e.g. uses hoist, requires 2 carers"
                />
              </Field>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pending} className="btn-primary flex-1">
                  {pending ? 'Saving…' : mode === 'add' ? 'Add resident' : 'Save changes'}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
