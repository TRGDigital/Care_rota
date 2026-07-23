'use client'

import { useState, useTransition } from 'react'
import { seedDefaultTopics, createTopic, deleteTopic } from './actions'

type Topic = { id: string; code: string; name: string; renewal_interval_months: number; enforcement_mode: string }

export function TrainingMatrixClient({ homeId, initialTopics }: { homeId: string; initialTopics: Topic[] }) {
  const [topics, setTopics] = useState(initialTopics)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSeed() {
    startTransition(async () => {
      const result = await seedDefaultTopics(homeId)
      if (result.error) setError(result.error)
    })
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await createTopic(homeId, fd)
      if (result.error) { setError(result.error); return }
      setShowForm(false)
      ;(e.target as HTMLFormElement).reset()
    })
  }

  function handleDelete(topicId: string) {
    startTransition(async () => {
      await deleteTopic(homeId, topicId)
      setTopics(prev => prev.filter(t => t.id !== topicId))
    })
  }

  return (
    <div className="max-w-2xl space-y-4 mt-6">
      {topics.length === 0 && (
        <div className="bg-muted/30 border rounded-lg p-4 text-sm text-muted-foreground flex items-center justify-between">
          <span>No training topics yet.</span>
          <button
            onClick={handleSeed}
            disabled={pending}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            {pending ? 'Loading…' : 'Load CQC defaults'}
          </button>
        </div>
      )}

      {topics.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Code</th>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Renewal</th>
                <th className="text-left px-4 py-2 font-medium">Mode</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {topics.map(t => (
                <tr key={t.id} className="bg-card hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.renewal_interval_months}m</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      t.enforcement_mode === 'hard'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {t.enforcement_mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={pending}
                      className="text-xs text-destructive hover:underline disabled:opacity-40"
                    >
                      Delete
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
          <h3 className="text-sm font-semibold">Add training topic</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Code</label>
              <input name="code" required placeholder="FIRE" className="w-full border rounded px-3 py-1.5 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Renewal (months)</label>
              <input name="renewal_interval_months" type="number" min={1} max={120} defaultValue={12} required className="w-full border rounded px-3 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Name</label>
              <input name="name" required className="w-full border rounded px-3 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Mode</label>
              <select name="enforcement_mode" className="w-full border rounded px-3 py-1.5 text-sm bg-background">
                <option value="hard">Hard (blocks shift assignment)</option>
                <option value="soft">Soft (warning only)</option>
              </select>
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
          + Add topic
        </button>
      )}
    </div>
  )
}
