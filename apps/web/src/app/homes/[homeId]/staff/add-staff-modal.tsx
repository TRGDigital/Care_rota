'use client'

import { useState, useTransition } from 'react'
import { UserPlus, X } from 'lucide-react'
import { createStaff } from './actions'

export function AddStaffModal({ homeId }: { homeId: string }) {
  const [open,              setOpen]              = useState(false)
  const [error,             setError]             = useState<string | null>(null)
  const [overtimeEligible,  setOvertimeEligible]  = useState(true)
  const [pending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]!

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createStaff(homeId, fd)
      if (result?.error) setError(result.error)
      // On success createStaff calls redirect() — navigates to the new profile
    })
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(true); setOvertimeEligible(true) }}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <UserPlus size={15} />
        Add staff member
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-card shadow-xl max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-foreground">Add staff member</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form id="add-staff-form" onSubmit={handleSubmit} className="space-y-6">

                {/* Personal details */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Personal details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">First name *</label>
                      <input
                        name="first_name"
                        required
                        placeholder="Jane"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Last name *</label>
                      <input
                        name="last_name"
                        required
                        placeholder="Smith"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Employee number</label>
                      <input
                        name="employee_number"
                        placeholder="EMP001"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Date of birth</label>
                      <input
                        name="date_of_birth"
                        type="date"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">NI number</label>
                      <input
                        name="ni_number"
                        placeholder="AB123456C"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Start date</label>
                      <input
                        name="date_started"
                        type="date"
                        defaultValue={today}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                    </div>
                  </div>
                </section>

                {/* Initial contract */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Initial contract
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Contract type *</label>
                      <select
                        name="contract_type"
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      >
                        <option value="full_time">Full time</option>
                        <option value="part_time">Part time</option>
                        <option value="bank">Bank</option>
                        <option value="zero_hours">Zero hours</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Contracted hrs/week *</label>
                      <input
                        name="contracted_hours_per_week"
                        type="number"
                        step="0.5"
                        min={0}
                        max={168}
                        defaultValue={37.5}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Shift preference</label>
                      <select
                        name="shift_pattern_preference"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      >
                        <option value="any">Any</option>
                        <option value="day_only">Days only</option>
                        <option value="night_only">Nights only</option>
                        <option value="days_and_nights">Days and nights</option>
                        <option value="early_only">Early only</option>
                        <option value="late_only">Late only</option>
                        <option value="no_nights">No nights</option>
                        <option value="no_weekends">No weekends</option>
                        <option value="fixed">Fixed pattern</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Holiday entitlement (days) *</label>
                      <input
                        name="holiday_entitlement_value"
                        type="number"
                        step="0.01"
                        min={0}
                        max={9999}
                        defaultValue={28}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Contract effective from *</label>
                      <input
                        name="effective_from"
                        type="date"
                        defaultValue={today}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                    </div>
                  </div>
                </section>

                {/* Overtime */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Overtime
                  </h3>
                  <input type="hidden" name="overtime_eligible" value={overtimeEligible ? 'on' : 'off'} />
                  <button
                    type="button"
                    onClick={() => setOvertimeEligible(v => !v)}
                    className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      overtimeEligible
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-gray-200 bg-muted/30'
                    }`}
                  >
                    <span className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${overtimeEligible ? 'bg-primary' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${overtimeEligible ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {overtimeEligible ? 'Eligible for overtime' : 'Not eligible for overtime'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {overtimeEligible
                          ? 'This person can be offered overtime shifts'
                          : 'This person will never be offered overtime shifts'}
                      </p>
                    </div>
                  </button>
                </section>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}

              </form>
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-300 bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-staff-form"
                disabled={pending}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {pending ? 'Creating…' : 'Create staff member'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
