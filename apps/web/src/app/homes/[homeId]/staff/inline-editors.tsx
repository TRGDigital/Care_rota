'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateShiftType, updateContractStatus, updateLeave } from './directory-edit-actions'

const selectCls = 'text-sm border border-border rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent/50'
const numCls = 'w-16 text-center text-xs tabular-nums border border-border rounded px-1 py-0.5 bg-surface focus:outline-none focus:ring-1 focus:ring-accent/50'

function Tick({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving) return <span className="text-xs text-ink-subtle">…</span>
  if (saved) return <span className="text-xs text-green-700">✓</span>
  return null
}

export function ShiftTypeSelect({ homeId, staffId, value }: { homeId: string; staffId: string; value: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  async function onChange(v: string) {
    setSaving(true)
    await updateShiftType(homeId, staffId, v as 'day' | 'night' | 'both')
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500); router.refresh()
  }
  return (
    <div className="flex items-center gap-1">
      <select value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
        <option value="day">Day</option>
        <option value="night">Night</option>
        <option value="both">Both</option>
      </select>
      <Tick saving={saving} saved={saved} />
    </div>
  )
}

// Combined contract type + long-term-sick control. `status` is the staff status; when it's
// long_term_sick that option is shown as selected regardless of the underlying contract type.
export function ContractStatusSelect({
  homeId, staffId, contractType, status,
}: { homeId: string; staffId: string; contractType: string | null; status: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const current = status === 'long_term_sick' ? 'long_term_sick' : (contractType ?? '')
  async function onChange(v: string) {
    if (!v) return
    setSaving(true)
    await updateContractStatus(homeId, staffId, v)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500); router.refresh()
  }
  return (
    <div className="flex items-center gap-1">
      <select value={current} onChange={e => onChange(e.target.value)} className={selectCls}>
        {!current && <option value="">— set —</option>}
        <option value="full_time">Full time</option>
        <option value="part_time">Part time</option>
        <option value="bank">Bank</option>
        <option value="zero_hours">Zero hours</option>
        <option value="long_term_sick">Long-term sick</option>
      </select>
      <Tick saving={saving} saved={saved} />
    </div>
  )
}

export function LeaveEdit({
  homeId, staffId, entitlement, taken, unit,
}: { homeId: string; staffId: string; entitlement: number; taken: number; unit: string }) {
  const router = useRouter()
  const [ent, setEnt] = useState(entitlement)
  const [tkn, setTkn] = useState(taken)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (ent === entitlement && tkn === taken) return
    setSaving(true)
    await updateLeave(homeId, staffId, ent, tkn)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500); router.refresh()
  }

  const remaining = Math.round((ent - tkn) * 10) / 10

  return (
    <div className="flex items-center gap-1.5 justify-center" title="Annual leave: entitlement / taken">
      <input type="number" min={0} step={0.5} value={ent}
        onChange={e => setEnt(Math.max(0, Number(e.target.value)))}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className={numCls} title="Entitlement" />
      <span className="text-ink-subtle text-xs">/</span>
      <input type="number" min={0} step={0.5} value={tkn}
        onChange={e => setTkn(Math.max(0, Number(e.target.value)))}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className={numCls} title="Taken" />
      <span className={`text-xs tabular-nums ${remaining < 3 ? 'text-amber-600' : 'text-green-700'}`}>
        = {remaining}{unit}
      </span>
      <Tick saving={saving} saved={saved} />
    </div>
  )
}
