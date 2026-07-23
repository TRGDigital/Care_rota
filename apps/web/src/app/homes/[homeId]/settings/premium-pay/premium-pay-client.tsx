'use client'

import { useState, useTransition } from 'react'
import { loadBankHolidays, addPremiumPayDate, deletePremiumPayDate } from './actions'

type Entry = { id: string; calendar_date: string; name: string; multiplier: number; source: string }

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function PremiumPayClient({ homeId, initialEntries }: { homeId: string; initialEntries: Entry[] }) {
  const [entries, setEntries] = useState(initialEntries)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleLoad() {
    startTransition(async () => {
      const result = await loadBankHolidays(homeId)
      if (result.error) setError(result.error)
    })
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await addPremiumPayDate(homeId, fd)
      if (result.error) { setError(result.error); return }
      setShowForm(false)
      ;(e.target as HTMLFormElement).reset()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deletePremiumPayDate(homeId, id)
      setEntries(prev => prev.filter(e => e.id !== id))
    })
  }

  return (
    <div className="max-w-2xl space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{entries.length} date{entries.length !== 1 ? 's' : ''} configured</p>
        <button
          onClick={handleLoad}
          disabled={pending}
          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          {pending ? '…' : 'Load 2026 bank holidays'}
        </button>
      </div>

      {entries.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-right px-4 py-2 font-medium">Multiplier</th>
                <th className="text-left px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map(e => (
                <tr key={e.id} className="bg-card hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(e.calendar_date)}</td>
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3 text-right">{e.multiplier}×</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {e.source === 'auto_bank_holiday' ? 'Auto' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={pending}
                      className="text-xs text-destructive hover:underline disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleAdd} className="bg-card border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold">Add date</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Date *</label>
              <input name="calendar_date" type="date" required className="w-full border rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Multiplier *</label>
              <input name="multiplier" type="number" step="0.25" min={1} max={5} defaultValue={1.5} required className="w-full border rounded px-3 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Name *</label>
              <input name="name" required placeholder="e.g. Christmas Day" className="w-full border rounded px-3 py-1.5 text-sm" />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm px-3 py-1.5 rounded border">Cancel</button>
            <button type="submit" disabled={pending} className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="text-sm font-medium text-primary hover:underline">
          + Add date manually
        </button>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
