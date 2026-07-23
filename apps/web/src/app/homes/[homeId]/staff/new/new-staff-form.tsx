'use client'

import { useState, useTransition } from 'react'
import { createStaff } from '../actions'

type Role = { id: string; code: string; name: string }
type Pattern = { id: string; name: string }

export function NewStaffForm({ homeId, roles, patterns }: { homeId: string; roles: Role[]; patterns: Pattern[] }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createStaff(homeId, fd)
      if (result?.error) setError(result.error)
    })
  }

  const today = new Date().toISOString().split('T')[0]!

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Personal details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">First name *</label>
            <input name="first_name" required className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Last name *</label>
            <input name="last_name" required className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Employee number</label>
            <input name="employee_number" className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Date of birth</label>
            <input name="date_of_birth" type="date" className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">NI number</label>
            <input name="ni_number" placeholder="AB123456C" className="w-full border rounded px-3 py-1.5 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Start date</label>
            <input name="date_started" type="date" defaultValue={today} className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Initial contract</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Contract type *</label>
            <select name="contract_type" required className="w-full border rounded px-3 py-1.5 text-sm bg-background">
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="bank">Bank</option>
              <option value="zero_hours">Zero hours</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Contracted hrs/week *</label>
            <input name="contracted_hours_per_week" type="number" step="0.5" min={0} max={168} defaultValue={37.5} required className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Shift preference</label>
            <select name="shift_pattern_preference" className="w-full border rounded px-3 py-1.5 text-sm bg-background">
              <option value="any">Any</option>
              <option value="day_only">Days only</option>
              <option value="night_only">Nights only</option>
              <option value="fixed">Fixed pattern</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Holiday entitlement (days) *</label>
            <input name="holiday_entitlement_value" type="number" step="0.5" min={0} max={365} defaultValue={28} required className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">Contract effective from *</label>
            <input name="effective_from" type="date" defaultValue={today} required className="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <a href={`/homes/${homeId}/staff`} className="text-sm px-4 py-2 rounded border">Cancel</a>
        <button type="submit" disabled={pending} className="text-sm px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50">
          {pending ? 'Creating…' : 'Create staff member'}
        </button>
      </div>
    </form>
  )
}
