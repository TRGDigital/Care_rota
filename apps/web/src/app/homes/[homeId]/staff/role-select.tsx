'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStaffRole } from './role-actions'

export function RoleSelect({
  homeId, staffId, value, roles,
}: {
  homeId: string
  staffId: string
  value: string | null
  roles: { code: string; name: string }[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function onChange(code: string) {
    if (!code || code === value) return
    setSaving(true)
    await updateStaffRole(homeId, staffId, code)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-border rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
      >
        {!value && <option value="">— select —</option>}
        {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
      </select>
      {saving && <span className="text-xs text-ink-subtle">…</span>}
      {saved && !saving && <span className="text-xs text-green-700">✓</span>}
    </div>
  )
}
