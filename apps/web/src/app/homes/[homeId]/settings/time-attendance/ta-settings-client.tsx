'use client'

import { useState, useTransition } from 'react'
import { Button } from '@carerota/ui'
import { saveGraceWindows, saveGeofence } from './actions'
import { RefreshCw } from 'lucide-react'

type Geofence = {
  id: string
  centre_lat: number
  centre_lng: number
  radius_metres: number
} | null

export function TASettingsClient(props: {
  homeId: string
  tenantId: string
  noShowGraceMinutes: number
  noClockOutHoldMinutes: number
  clockInEarlyWindowMinutes: number
  geofence: Geofence
}) {
  const [noShow, setNoShow]     = useState(String(props.noShowGraceMinutes))
  const [noOut, setNoOut]       = useState(String(props.noClockOutHoldMinutes))
  const [early, setEarly]       = useState(String(props.clockInEarlyWindowMinutes))

  const [gLat, setGLat]         = useState(String(props.geofence?.centre_lat ?? ''))
  const [gLng, setGLng]         = useState(String(props.geofence?.centre_lng ?? ''))
  const [gRadius, setGRadius]   = useState(String(props.geofence?.radius_metres ?? '100'))

  const [graceMsg, setGraceMsg]   = useState('')
  const [geoMsg, setGeoMsg]       = useState('')
  const [isPendingGrace, startGrace] = useTransition()
  const [isPendingGeo, startGeo]     = useTransition()

  function handleSaveGrace() {
    startGrace(async () => {
      const result = await saveGraceWindows(props.homeId, {
        noShowGraceMinutes:        parseInt(noShow, 10),
        noClockOutHoldMinutes:     parseInt(noOut, 10),
        clockInEarlyWindowMinutes: parseInt(early, 10),
      })
      setGraceMsg(result.error ? `Error: ${result.error}` : 'Saved')
      setTimeout(() => setGraceMsg(''), 3000)
    })
  }

  function handleSaveGeo() {
    startGeo(async () => {
      const result = await saveGeofence(props.homeId, props.tenantId, {
        centre_lat:    parseFloat(gLat),
        centre_lng:    parseFloat(gLng),
        radius_metres: parseInt(gRadius, 10),
        existingId:    props.geofence?.id ?? null,
      })
      setGeoMsg(result.error ? `Error: ${result.error}` : 'Saved')
      setTimeout(() => setGeoMsg(''), 3000)
    })
  }

  return (
    <div className="max-w-lg mt-6 space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Grace windows</h2>
        <p className="text-xs text-muted-foreground">
          These thresholds determine when the reconciliation worker changes a shift state.
        </p>
        <div className="bg-card border rounded-lg divide-y">
          <Field
            label="No-show grace (minutes)"
            description="How long after planned start before a missing clock-in is marked no_show"
            value={noShow}
            onChange={setNoShow}
          />
          <Field
            label="No-clock-out hold (minutes)"
            description="How long after planned end before a missing clock-out triggers the no_clock_out state"
            value={noOut}
            onChange={setNoOut}
          />
          <Field
            label="Early clock-in window (minutes)"
            description="How far before planned start staff can clock in on mobile"
            value={early}
            onChange={setEarly}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSaveGrace} disabled={isPendingGrace}>
            {isPendingGrace && <RefreshCw className="h-3 w-3 animate-spin mr-1" />}
            Save grace windows
          </Button>
          {graceMsg && <span className="text-xs text-muted-foreground">{graceMsg}</span>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Geofence (mobile clock-in)</h2>
        <p className="text-xs text-muted-foreground">
          The GPS boundary for mobile clock-in. Staff must be within the radius of these
          co-ordinates to clock in on their phone.
        </p>
        <div className="bg-card border rounded-lg divide-y">
          <Field
            label="Centre latitude"
            description="Decimal degrees (e.g. 51.5074)"
            value={gLat}
            onChange={setGLat}
          />
          <Field
            label="Centre longitude"
            description="Decimal degrees (e.g. -0.1278)"
            value={gLng}
            onChange={setGLng}
          />
          <Field
            label="Radius (metres)"
            description="Default 100m. Maximum recommended 500m."
            value={gRadius}
            onChange={setGRadius}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSaveGeo} disabled={isPendingGeo}>
            {isPendingGeo && <RefreshCw className="h-3 w-3 animate-spin mr-1" />}
            Save geofence
          </Button>
          {geoMsg && <span className="text-xs text-muted-foreground">{geoMsg}</span>}
        </div>
      </section>
    </div>
  )
}

function Field({
  label, description, value, onChange,
}: {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-24 border rounded px-2 py-1 text-sm text-right"
      />
    </div>
  )
}
