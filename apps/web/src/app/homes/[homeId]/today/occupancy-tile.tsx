'use client'

import { useState, useTransition } from 'react'
import { confirmOccupancy, updateOccupancy } from './actions'

type Snapshot = {
  id: string
  occupied_beds: number
  vacant_beds: number
  snapshot_at: string
}

type Props = {
  homeId: string
  totalBeds: number
  latestSnapshot: Snapshot | null
  daysSinceSnapshot: number | null
}

export function OccupancyTile({ homeId, totalBeds, latestSnapshot, daysSinceSnapshot }: Props) {
  const [showUpdate, setShowUpdate] = useState(false)
  const [occupied, setOccupied] = useState(latestSnapshot?.occupied_beds ?? 0)
  const [pending, startTransition] = useTransition()

  const isStale = daysSinceSnapshot !== null && daysSinceSnapshot >= 3
  const confirmedToday = latestSnapshot
    ? new Date(latestSnapshot.snapshot_at).toDateString() === new Date().toDateString()
    : false

  function handleConfirm() {
    startTransition(async () => {
      await confirmOccupancy(homeId)
    })
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateOccupancy(homeId, fd)
      setShowUpdate(false)
    })
  }

  return (
    <div className={`rounded-lg border bg-card p-5 space-y-4 ${isStale ? 'border-amber-300' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Occupancy</div>
          {latestSnapshot ? (
            <div className="mt-1 text-3xl font-bold tabular-nums">
              {latestSnapshot.occupied_beds}
              <span className="text-base font-normal text-muted-foreground"> / {totalBeds}</span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">No data yet</div>
          )}
        </div>
        {latestSnapshot && (
          <div className={`text-xs rounded-full px-2 py-0.5 ${confirmedToday ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
            {confirmedToday ? 'Confirmed today' : `Updated ${daysSinceSnapshot}d ago`}
          </div>
        )}
      </div>

      {isStale && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
          Occupancy data is {daysSinceSnapshot} days old. Please confirm or update.
        </div>
      )}

      {!showUpdate ? (
        <div className="flex gap-2">
          {!confirmedToday && latestSnapshot && (
            <button
              onClick={handleConfirm}
              disabled={pending}
              className="flex-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? 'Confirming…' : 'Confirm today\'s occupancy'}
            </button>
          )}
          <button
            onClick={() => setShowUpdate(true)}
            className="flex-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Update occupancy
          </button>
        </div>
      ) : (
        <form onSubmit={handleUpdate} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Occupied beds</label>
            <input
              name="occupied_beds"
              type="number"
              min={0}
              max={totalBeds}
              value={occupied}
              onChange={e => setOccupied(Number(e.target.value))}
              className="input-base w-24"
            />
            <div className="text-xs text-muted-foreground">{totalBeds - occupied} vacant</div>
          </div>
          <input type="hidden" name="vacant_beds" value={totalBeds - occupied} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary flex-1">
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowUpdate(false)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
