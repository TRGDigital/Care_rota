'use client'

import { useState, useTransition } from 'react'
import { importCareStreamCsv, type ImportResult } from './actions'

type Preview = {
  resident_external_ref: string
  first_name: string
  last_name_initial: string
  room_number: string
  dependency_band: string
  assessment_date: string
}

export function CsvImportForm({ homeId }: { homeId: string }) {
  const [preview, setPreview] = useState<Preview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pending, startTransition] = useTransition()

  const VALID_BANDS = new Set(['low', 'medium', 'high', 'one_to_one'])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setResult(null)
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const lines = text.trim().split('\n')
        const rows = lines.slice(1).map(line => {
          const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
          const [ref, first, initial, room, band, date] = parts
          return {
            resident_external_ref: ref ?? '',
            first_name:            first ?? '',
            last_name_initial:     initial ?? '',
            room_number:           room ?? '',
            dependency_band:       band ?? '',
            assessment_date:       date ?? '',
          }
        }).filter(r => r.resident_external_ref && r.first_name)

        const invalid = rows.find(r => !VALID_BANDS.has(r.dependency_band))
        if (invalid) {
          setError(`Invalid dependency_band "${invalid.dependency_band}" — must be low, medium, high, or one_to_one`)
          return
        }
        setPreview(rows)
      } catch {
        setError('Could not parse CSV. Check the format matches the template above.')
      }
    }
    reader.readAsText(file)
  }

  function handleImport() {
    startTransition(async () => {
      try {
        const res = await importCareStreamCsv(homeId, preview)
        setResult(res)
        setPreview([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Upload CSV</label>
        <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
      </div>

      {preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{preview.length} residents in CSV:</p>
          <div className="max-h-48 overflow-y-auto rounded border text-xs divide-y">
            {preview.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span className="font-mono text-muted-foreground w-20 shrink-0">{r.resident_external_ref}</span>
                <span className="font-medium">{r.first_name} {r.last_name_initial}.</span>
                <span className="text-muted-foreground">Room {r.room_number}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${bandColour(r.dependency_band)}`}>
                  {r.dependency_band}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={handleImport}
            disabled={pending}
            className="btn-primary text-sm"
          >
            {pending ? 'Importing…' : `Import ${preview.length} residents`}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="rounded border bg-green-50 border-green-200 p-3 text-sm text-green-800">
            Import complete — {result.created} added, {result.updated} updated.
          </div>

          {/* AT-15: flag residents in DB but absent from this CSV */}
          {result.possiblyDischarged.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                {result.possiblyDischarged.length} resident{result.possiblyDischarged.length !== 1 ? 's' : ''} not in this CSV
              </p>
              <p className="text-xs text-amber-700">
                These residents are active in CareRota but missing from the file you just imported.
                If they have been discharged, please record their discharge date in the Residents list.
              </p>
              <ul className="space-y-1">
                {result.possiblyDischarged.map(r => (
                  <li key={r.id} className="text-xs text-amber-800 flex items-center gap-2">
                    <span className="font-medium">{r.first_name}</span>
                    {r.room_number && <span className="text-amber-600">Room {r.room_number}</span>}
                    <span className="font-mono text-amber-500">{r.external_resident_ref}</span>
                  </li>
                ))}
              </ul>
              <a
                href={`/homes/${homeId}/residents`}
                className="inline-block text-xs font-medium text-amber-800 underline"
              >
                Go to Residents →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function bandColour(b: string) {
  return {
    low:        'bg-green-100 text-green-800',
    medium:     'bg-yellow-100 text-yellow-800',
    high:       'bg-orange-100 text-orange-800',
    one_to_one: 'bg-red-100 text-red-800',
  }[b] ?? 'bg-muted text-muted-foreground'
}
