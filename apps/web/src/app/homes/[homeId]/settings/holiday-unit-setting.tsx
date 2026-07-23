'use client'

import { useRef, useState, useTransition } from 'react'
import { setHolidayUnit } from './actions'

export function HolidayUnitSetting({
  homeId,
  currentUnit,
  hasLeaveRequests,
}: {
  homeId: string
  currentUnit: 'days' | 'hours'
  hasLeaveRequests: boolean
}) {
  const savedUnit  = useRef(currentUnit)
  const [unit,     setUnit]     = useState(currentUnit)
  const [saved,    setSaved]    = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await setHolidayUnit(homeId, unit)
      if (result?.error) {
        setErrorMsg(result.error)
      } else {
        savedUnit.current = unit
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div>
        <p className="text-sm font-medium">Holiday allocation unit</p>
        <p className="text-sm text-muted-foreground mt-1">
          Some homes allocate annual leave in days, others in hours. Most care homes
          with variable-length shifts choose hours.
        </p>
      </div>

      {hasLeaveRequests && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          Leave requests already exist — changing the unit will not automatically convert existing records.
        </div>
      )}

      <div className="flex items-center gap-3">
        <fieldset className="flex gap-4" disabled={isPending}>
          {(['hours', 'days'] as const).map(option => (
            <label key={option} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="holiday_unit"
                value={option}
                checked={unit === option}
                onChange={() => { setUnit(option); setSaved(false); setErrorMsg(null) }}
                className="accent-primary"
              />
              <span className="text-sm capitalize">{option}</span>
            </label>
          ))}
        </fieldset>

        <button
          onClick={handleSave}
          disabled={isPending || unit === savedUnit.current}
          className="ml-auto rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {errorMsg && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMsg}</p>
      )}
    </div>
  )
}
