'use client'

import { useState, useTransition } from 'react'
import { importHistoricalRota } from './actions'

type Batch = {
  import_batch_id: string
  source_file: string | null
  created_at: string
  count: number
}

export function RotoHistoryClient({ homeId, batches }: { homeId: string; batches: Batch[] }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null)

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setResult(null)
    startTransition(async () => {
      const r = await importHistoricalRota(homeId, fd)
      setResult(r)
      if (r.success) (e.target as HTMLFormElement).reset()
    })
  }

  return (
    <div className="max-w-2xl space-y-6 mt-6">
      <div className="bg-muted/30 border rounded-lg p-4 text-sm space-y-2">
        <p className="font-medium">CSV format</p>
        <p className="text-muted-foreground text-xs">
          Expected columns: <span className="font-mono">Staff Name, Date, Start Time, End Time</span> (optional: Role).
          Date in DD/MM/YYYY. Time in HH:MM or HHMM. First row is the header.
        </p>
        <pre className="text-xs bg-background border rounded p-2 overflow-x-auto">
{`Staff Name,Date,Start Time,End Time,Role
Mary Smith,01/05/2026,07:00,19:00,Care Assistant
John Jones,01/05/2026,19:00,07:00,Senior Care`}
        </pre>
      </div>

      <form onSubmit={handleUpload} className="bg-card border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold">Upload historical rota</h3>
        <div>
          <label className="block text-xs font-medium mb-1">CSV file *</label>
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border file:text-sm file:bg-background file:hover:bg-muted/40 cursor-pointer"
          />
        </div>
        {result?.error && <p className="text-xs text-destructive">{result.error}</p>}
        {result?.count !== undefined && !result.error && (
          <p className="text-xs text-green-700">Imported {result.count} shift records.</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Importing…' : 'Import'}
          </button>
        </div>
      </form>

      {batches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Import history</h3>
          <div className="border rounded-lg divide-y">
            {batches.map(b => (
              <div key={b.import_batch_id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{b.source_file ?? 'Unknown file'}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{b.count} rows</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
