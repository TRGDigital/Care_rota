'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@carerota/ui'
import { UserPlus, Mail, CheckCircle2, Clock, Trash2 } from 'lucide-react'

type Invitation = {
  id: string
  name: string | null
  email: string
  firm_name: string | null
  role_scope: string
  accepted_at: string | null
  revoked_at: string | null
  last_login_at: string | null
  created_at: string
}

export function AccountantAccessClient({ homeId, invitations }: { homeId: string; invitations: Invitation[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [firmName, setFirmName] = useState('')
  const [scope, setScope] = useState<'home' | 'org'>('home')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function handleInvite() {
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return }
    setError('')
    startTransition(async () => {
      const res = await fetch(`/api/homes/${homeId}/accountant-invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), firmName: firmName.trim(), scope }),
      })
      if (!res.ok) {
        const d = await res.json() as { error: string }
        setError(d.error ?? 'Failed to send invitation')
        return
      }
      setSent(true)
      setShowForm(false)
      setName(''); setEmail(''); setFirmName('')
      router.refresh()
    })
  }

  function handleRevoke(invitationId: string) {
    if (!confirm('Revoke this accountant\'s access? They will be logged out immediately.')) return
    startTransition(async () => {
      await fetch(`/api/homes/${homeId}/accountant-invitations/${invitationId}`, { method: 'DELETE' })
      router.refresh()
    })
  }

  return (
    <div className="max-w-2xl mt-6 space-y-6">
      {sent && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Invitation sent. The accountant will receive an email to set up their account.
        </div>
      )}

      {showForm ? (
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Invite accountant</p>
          <input type="text" placeholder="Full name" className="w-full border rounded px-3 py-2 text-sm"
            value={name} onChange={e => setName(e.target.value)} />
          <input type="email" placeholder="Email address" className="w-full border rounded px-3 py-2 text-sm"
            value={email} onChange={e => setEmail(e.target.value)} />
          <input type="text" placeholder="Firm name (optional)" className="w-full border rounded px-3 py-2 text-sm"
            value={firmName} onChange={e => setFirmName(e.target.value)} />
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Access scope</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={scope} onChange={e => setScope(e.target.value as 'home' | 'org')}>
              <option value="home">This home only</option>
              <option value="org">All homes in organisation</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInvite} disabled={isPending}>
              <Mail className="h-3 w-3 mr-1" /> Send invitation
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Invite accountant
        </Button>
      )}

      {invitations.length > 0 && (
        <div className="bg-card border rounded-lg divide-y">
          {invitations.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{inv.name ?? inv.email}</span>
                  {inv.accepted_at
                    ? <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">Active</span>
                    : <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Pending</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {inv.email}
                  {inv.firm_name && ` · ${inv.firm_name}`}
                  {inv.last_login_at && ` · Last login ${new Date(inv.last_login_at).toLocaleDateString('en-GB')}`}
                </div>
              </div>
              <button onClick={() => handleRevoke(inv.id)} disabled={isPending}
                className="text-muted-foreground hover:text-red-600 transition-colors p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {invitations.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No accountants invited yet.</p>
      )}
    </div>
  )
}
