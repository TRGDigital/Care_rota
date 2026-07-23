'use client'

import { useState } from 'react'
import type { Citation } from '@carerota/domain'

type Props = {
  citation: Citation
  index:    number
}

export function CitationChip({ citation, index }: Props) {
  const [open, setOpen] = useState(false)
  const rowCount = citation.source_rows.length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-label={`Source: ${rowCount} ${citation.source_tool} row${rowCount !== 1 ? 's' : ''}, click to view`}
      >
        <span aria-hidden>📎</span>
        <span>{index + 1}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Citation ${index + 1}: ${citation.source_tool}`}
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border bg-background shadow-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Source: <code className="text-xs bg-muted px-1 rounded">{citation.source_tool}</code>
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close citation panel"
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-sm font-medium">{citation.text}</p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{rowCount} contributing row{rowCount !== 1 ? 's' : ''}:</p>
              <ul className="max-h-40 overflow-y-auto space-y-0.5">
                {citation.source_rows.map(rowId => (
                  <li key={rowId} className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    {rowId}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
