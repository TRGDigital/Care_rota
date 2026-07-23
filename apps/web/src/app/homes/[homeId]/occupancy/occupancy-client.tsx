'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@carerota/ui'
import { BedDouble, Plus, TrendingDown, TrendingUp, Minus } from 'lucide-react'

type Snapshot = {
  id: string
  snapshot_at: string
  occupied_beds: number
  vacant_beds: number
  expected_admissions_next_7_days: number
  expected_discharges_next_7_days: number
  source: string
}

type Props = {
  homeId: string
  bedCapacity: number
  snapshots: Snapshot[]
}

export function OccupancyClient({ homeId, bedCapacity, snapshots }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [occupiedBeds, setOccupiedBeds] = useState(snapshots[0]?.occupied_beds ?? 0)
  const [admissions, setAdmissions] = useState(0)
  const [discharges, setDischarges] = useState(0)
  const [error, setError] = useState('')

  const vacantBeds = bedCapacity - occupiedBeds
  const latest = snapshots[0]
  const prev = snapshots[1]
  const delta = latest && prev ? latest.occupied_beds - prev.occupied_beds : null

  function handleSave() {
    if (occupiedBeds < 0 || occupiedBeds > bedCapacity) {
      setError(`Occupied beds must be between 0 and ${bedCapacity}`)
      return
    }
    setError('')
    startTransition(async () => {
      const res = await fetch(`/api/homes/${homeId}/occupancy/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occupiedBeds,
          vacantBeds: bedCapacity - occupiedBeds,
          expectedAdmissionsNext7Days: admissions,
          expectedDischargesNext7Days: discharges,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error: string }
        setError(d.error ?? 'Failed to save')
        return
      }
      setShowForm(false)
      router.refresh()
    })
  }

  return (
    <div className="max-w-2xl space-y-6 mt-6">
      {/* Current occupancy tile */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <BedDouble className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Current occupancy</h2>
          {delta !== null && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              delta > 0 ? 'bg-green-100 text-green-800' :
              delta < 0 ? 'bg-amber-100 text-amber-800' :
              'bg-muted text-muted-foreground'
            }`}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {delta > 0 ? `+${delta}` : delta} since last snapshot
            </span>
          )}
        </div>

        {latest ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-3xl font-bold">{latest.occupied_beds}</div>
              <div className="text-xs text-muted-foreground">Occupied</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-muted-foreground">{latest.vacant_beds}</div>
              <div className="text-xs text-muted-foreground">Vacant</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{bedCapacity}</div>
              <div className="text-xs text-muted-foreground">Capacity</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No snapshots recorded yet.</p>
        )}

        {latest && (
          <p className="text-xs text-muted-foreground mt-3">
            Last updated {new Date(latest.snapshot_at).toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
            {latest.source !== 'manual' && ` · via ${latest.source.replace('_', ' ')}`}
          </p>
        )}
      </div>

      {/* Record form */}
      {showForm ? (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <p className="font-medium text-sm">Record today's occupancy</p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Occupied beds (of {bedCapacity})</label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="number"
                  min={0}
                  max={bedCapacity}
                  value={occupiedBeds}
                  onChange={e => setOccupiedBeds(parseInt(e.target.value) || 0)}
                  className="w-24 border rounded px-3 py-2 text-sm"
                />
                <span className="text-sm text-muted-foreground">→ {vacantBeds} vacant</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Expected admissions (7 days)</label>
                <input
                  type="number"
                  min={0}
                  value={admissions}
                  onChange={e => setAdmissions(parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Expected discharges (7 days)</label>
                <input
                  type="number"
                  min={0}
                  value={discharges}
                  onChange={e => setDischarges(parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>Save snapshot</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Record occupancy
        </Button>
      )}

      {/* History */}
      {snapshots.length > 1 && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-sm font-medium">Occupancy history</p>
          </div>
          <div className="divide-y">
            {snapshots.map(s => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                <div className="flex-1">
                  <span className="font-medium">{s.occupied_beds} / {s.occupied_beds + s.vacant_beds}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {new Date(s.snapshot_at).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  s.source === 'manual' ? 'bg-muted text-muted-foreground' : 'bg-blue-100 text-blue-700'
                }`}>
                  {s.source.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
