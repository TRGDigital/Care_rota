'use client'

import { useState, useTransition } from 'react'
import { bulkImportBeds } from './actions'

export function BulkBedImport({ homeId }: { homeId: string }) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<{ room_number: string; capacity: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const lines = text.trim().split('\n')
        const rows = lines.slice(1).map(line => {
          const [room, cap] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
          return { room_number: room ?? '', capacity: parseInt(cap ?? '1', 10) || 1 }
        }).filter(r => r.room_number)
        setPreview(rows)
        setError(null)
      } catch {
        setError('Could not parse CSV. Expected columns: room_number, capacity')
      }
    }
    reader.readAsText(file)
  }

  function handleImport() {
    startTransition(async () => {
      try {
        await bulkImportBeds(homeId, preview)
        setOpen(false)
        setPreview([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed')
      }
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary text-sm">Import CSV</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-card border shadow-lg p-6 space-y-4">
            <h2 className="text-base font-semibold">Import beds from CSV</h2>
            <p className="text-sm text-muted-foreground">
              CSV must have columns: <code className="font-mono text-xs bg-muted px-1 rounded">room_number, capacity</code>
            </p>
            <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
            {preview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{preview.length} beds to import:</p>
                <div className="max-h-40 overflow-y-auto text-xs border rounded p-2 space-y-1">
                  {preview.map((r, i) => (
                    <div key={i}>Room {r.room_number} — {r.capacity === 1 ? 'Single' : 'Double'}</div>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleImport} disabled={pending || preview.length === 0} className="btn-primary flex-1">
                {pending ? 'Importing…' : `Import ${preview.length} beds`}
              </button>
              <button onClick={() => { setOpen(false); setPreview([]) }} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
