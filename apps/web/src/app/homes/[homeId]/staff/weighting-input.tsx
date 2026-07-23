'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function WeightingInput({
  homeId, staffId, value,
}: {
  homeId: string
  staffId: string
  value: number
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(Math.round(value * 10) / 10)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function save(next: number) {
    setSaving(true)
    await fetch(`/api/homes/${homeId}/staff-weighting`, {
      method: 'POST',
      body: JSON.stringify({ staffId, overtime_weighting: next }),
      headers: { 'Content-Type': 'application/json' },
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    router.refresh()
  }

  const display = current.toFixed(1) + '%'

  const color =
    current >= 25 ? 'text-green-700' :
    current >= 12 ? 'text-foreground' :
    current >  0  ? 'text-muted-foreground' :
                    'text-muted-foreground/40'

  return (
    <div className="flex items-center gap-1 justify-center">
      <input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={current}
        onChange={e => setCurrent(Math.min(100, Math.max(0, Number(e.target.value))))}
        onBlur={() => { if (current !== Math.round(value * 10) / 10) save(current) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className={`w-14 text-center text-xs font-medium tabular-nums border rounded px-1 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 ${color}`}
        title={`${display} of this role's overtime pool`}
      />
      <span className={`text-xs ${color}`}>%</span>
      {saving && <span className="text-xs text-muted-foreground">…</span>}
      {saved  && !saving && <span className="text-xs text-green-700">✓</span>}
    </div>
  )
}
