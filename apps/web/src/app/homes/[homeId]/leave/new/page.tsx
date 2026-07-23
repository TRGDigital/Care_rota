'use client'

import { useState, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import { submitLeaveRequest } from '../actions'

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual leave' },
  { value: 'compassionate', label: 'Compassionate leave' },
  { value: 'unpaid', label: 'Unpaid leave' },
  { value: 'toil', label: 'TOIL (time off in lieu)' },
  { value: 'maternity', label: 'Maternity leave' },
  { value: 'paternity', label: 'Paternity leave' },
  { value: 'shared_parental', label: 'Shared parental leave' },
  { value: 'adoption', label: 'Adoption leave' },
  { value: 'other', label: 'Other' },
]

export default function NewLeaveRequestPage() {
  const { homeId } = useParams<{ homeId: string }>()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await submitLeaveRequest(homeId, fd)
      if ('error' in result && result.error) {
        setError(result.error)
      } else {
        router.push(`/homes/${homeId}/leave`)
      }
    })
  }

  return (
    <PageShell
      title="New leave request"
      backHref={`/homes/${homeId}/leave`}
    >
      <form onSubmit={handleSubmit} className="max-w-lg mt-6 bg-card border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Leave type *</label>
          <select
            name="leave_type"
            required
            className="w-full border rounded px-3 py-1.5 text-sm bg-background"
          >
            {LEAVE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Start date *</label>
            <input
              name="start_date"
              type="date"
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">End date *</label>
            <input
              name="end_date"
              type="date"
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Hours requested *</label>
          <input
            name="value_requested"
            type="number"
            min="0.5"
            step="0.5"
            required
            placeholder="e.g. 7.5"
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">Enter total hours for the requested period.</p>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Note to manager (optional)</label>
          <textarea
            name="staff_message"
            rows={3}
            placeholder="Any context you'd like to share…"
            className="w-full border rounded px-3 py-1.5 text-sm resize-none"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm px-3 py-1.5 rounded border"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </PageShell>
  )
}
