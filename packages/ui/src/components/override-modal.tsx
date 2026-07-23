'use client'

import { useState } from 'react'
import { OVERRIDE_AUTHORISATION } from '@carerota/domain'

export type OverrideContext = Record<string, string | number | undefined>

export type OverrideModalProps = {
  open: boolean
  homeId: string
  ruleCode: string
  entityType: string
  entityId: string
  blockedAction: string
  context: OverrideContext          // human-readable data shown in the modal
  reasonCategories: string[]        // per-rule reason options
  onConfirmed: (override: unknown) => void
  onCancel: () => void
}

const MFA_LABELS: Record<string, string> = {
  password_reentry: 'Re-enter your password',
  totp:             'Enter authenticator code',
}

export function OverrideModal({
  open,
  homeId,
  ruleCode,
  entityType,
  entityId,
  blockedAction,
  context,
  reasonCategories,
  onConfirmed,
  onCancel,
}: OverrideModalProps) {
  const [reasonCategory, setReasonCategory] = useState(reasonCategories[0] ?? '')
  const [justification, setJustification] = useState('')
  const [mfaMethod, setMfaMethod] = useState<'password_reentry' | 'totp'>('password_reentry')
  const [mfaCredential, setMfaCredential] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const auth = OVERRIDE_AUTHORISATION[ruleCode]
  const justLen = justification.trim().length
  const canSubmit = justLen >= 20 && mfaCredential.length > 0 && reasonCategory.length > 0

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeId,
          ruleCode,
          entityType,
          entityId,
          blockedAction,
          reasonCategory,
          justification,
          mfaMethod,
          mfaCredential,
        }),
      })

      const json = await res.json() as { override?: unknown; error?: string }

      if (!res.ok) {
        setError(json.error ?? 'Override failed')
        return
      }

      onConfirmed(json.override)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-card border rounded-xl shadow-xl p-6 space-y-5">

        {/* Header */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-destructive">
            Rule override required
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">
            {formatRuleCode(ruleCode)}
          </h2>
        </div>

        {/* Context data */}
        <div className="rounded-md bg-muted p-3 text-sm space-y-1">
          {Object.entries(context).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
              <span className="font-medium text-right">{String(v ?? '—')}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason category */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Reason</label>
            <select
              value={reasonCategory}
              onChange={e => setReasonCategory(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {reasonCategories.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Justification */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Justification
              <span className={`ml-2 text-xs ${justLen >= 20 ? 'text-muted-foreground' : 'text-destructive'}`}>
                {justLen}/20 min
              </span>
            </label>
            <textarea
              value={justification}
              onChange={e => setJustification(e.target.value)}
              rows={3}
              placeholder="Describe why this override is necessary…"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* MFA */}
          <div className="space-y-2">
            <div className="flex gap-3">
              {(['password_reentry', 'totp'] as const).map(method => (
                <label key={method} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="mfa_method"
                    value={method}
                    checked={mfaMethod === method}
                    onChange={() => { setMfaMethod(method); setMfaCredential('') }}
                    className="accent-primary"
                  />
                  {MFA_LABELS[method]}
                </label>
              ))}
            </div>
            <input
              type={mfaMethod === 'password_reentry' ? 'password' : 'text'}
              value={mfaCredential}
              onChange={e => setMfaCredential(e.target.value)}
              placeholder={mfaMethod === 'password_reentry' ? 'Your password' : '6-digit code'}
              autoComplete="off"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {auth?.coSignRequired && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This override requires co-sign from an owner or registered manager within 24 hours.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="flex-1 rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Confirming…' : 'Confirm override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatRuleCode(code: string): string {
  return code
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
