'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateSpecialisms } from './directory-edit-actions'

// Mirrors CareStream's SECONDARY_ROLES (specialist roles).
export const SPECIALIST_ROLES = [
  'Safeguarding lead',
  'Infection prevention & control lead',
  'Dignity champion',
  'Caldicott Guardian',
  'Fire safety officer',
  'Hydration',
  'Room Checking',
  'Room & Water',
  'Nurse in Charge',
  'Night Staff',
]

export function SpecialistRolesSelect({
  homeId, staffId, value,
}: { homeId: string; staffId: string; value: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string[]>(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function toggle(role: string) {
    const next = selected.includes(role) ? selected.filter(r => r !== role) : [...selected, role]
    setSelected(next)
    setSaving(true)
    await updateSpecialisms(homeId, staffId, next)
    setSaving(false)
    router.refresh()
  }

  const label = selected.length === 0 ? 'None' : `${selected.length} selected`

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs border border-border rounded px-2 py-1 bg-surface text-ink hover:border-border-strong flex items-center gap-1 max-w-[13rem]"
        title={selected.join(', ') || 'No specialist roles'}
      >
        <span className="truncate">{label}</span>
        {saving && <span className="text-ink-subtle">…</span>}
        <svg className="h-3 w-3 shrink-0 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1 max-w-[13rem]">
          {selected.map(r => (
            <span key={r} className="inline-flex items-center rounded-full bg-accent/10 text-accent px-1.5 py-0.5 text-[10px] font-medium">{r}</span>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-lg border border-border bg-surface shadow-lg p-1">
          {SPECIALIST_ROLES.map(role => (
            <label key={role} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-canvas cursor-pointer text-sm text-ink">
              <input type="checkbox" checked={selected.includes(role)} onChange={() => toggle(role)} className="accent-accent" />
              <span>{role}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
