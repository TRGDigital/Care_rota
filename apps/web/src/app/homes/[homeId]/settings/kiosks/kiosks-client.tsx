'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@carerota/ui'
import { Monitor, Plus, Wifi, WifiOff, RefreshCw, Copy } from 'lucide-react'
import { generatePairingToken } from './actions'

type Kiosk = {
  id: string
  name: string
  is_active: boolean
  paired_at: string | null
  last_seen_at: string | null
  location_description: string | null
}

export function KiosksClient({
  homeId,
  initialKiosks,
}: {
  homeId: string
  initialKiosks: Kiosk[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [token, setToken]       = useState<string | null>(null)
  const [tokenName, setTokenName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [formError, setFormError] = useState('')

  function handleGenerate() {
    if (!tokenName.trim()) return
    setFormError('')
    startTransition(async () => {
      const result = await generatePairingToken(homeId, tokenName.trim())
      if (result.error) { setFormError(result.error); return }
      if (result.token) {
        setToken(result.token)
        setShowForm(false)
        setTokenName('')
        router.refresh()
      }
    })
  }

  function handleCopy() {
    if (!token) return
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mt-6 space-y-6">
      {token && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-amber-900">Pairing token generated</p>
          <p className="text-xs text-amber-700">
            Enter this token on the kiosk iPad. It expires in 1 hour and can only be used once.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-amber-300 rounded px-3 py-2 text-sm font-mono break-all">
              {token}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-1" />
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setToken(null)} className="text-amber-700">
            Dismiss
          </Button>
        </div>
      )}

      {showForm ? (
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">New kiosk</p>
          <input
            type="text"
            placeholder="Kiosk name (e.g. Main Entrance)"
            value={tokenName}
            onChange={e => setTokenName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            className="w-full border rounded px-3 py-2 text-sm"
            autoFocus
          />
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleGenerate} disabled={!tokenName.trim() || isPending}>
              {isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
              Generate token
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Pair new kiosk
        </Button>
      )}

      {initialKiosks.length === 0 && !showForm && (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          No kiosks paired yet. Click &ldquo;Pair new kiosk&rdquo; to get started.
        </div>
      )}

      {initialKiosks.length > 0 && (
        <div className="bg-card border rounded-lg divide-y">
          {initialKiosks.map(k => {
            const lastSeen = k.last_seen_at
              ? `Last seen ${new Date(k.last_seen_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`
              : 'Never connected'
            const recentMs = k.last_seen_at
              ? Date.now() - new Date(k.last_seen_at).getTime()
              : Infinity
            const isOnline = recentMs < 3 * 60 * 1000
            return (
              <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                <Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{k.name}</span>
                    {isOnline
                      ? <Wifi className="h-3 w-3 text-green-600" />
                      : <WifiOff className="h-3 w-3 text-muted-foreground" />}
                    {!k.is_active && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Inactive</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {k.location_description && <span>{k.location_description} · </span>}
                    {lastSeen}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
