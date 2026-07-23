'use client'

import * as React from 'react'
import { cn } from '../utils'

/* ── Base modal backdrop + panel ──────────────────────────────────────────────── */

function useEscapeKey(onClose: () => void) {
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
}

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, open: boolean) {
  React.useEffect(() => {
    if (!open || !ref.current) return
    const el = ref.current
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    first?.focus()

    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus() }
      }
    }
    el.addEventListener('keydown', trap)
    return () => el.removeEventListener('keydown', trap)
  }, [open, ref])
}

/* ── Standard modal ──────────────────────────────────────────────────────────── */

export type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const modalWidth = { sm: 'max-w-[440px]', md: 'max-w-[560px]', lg: 'max-w-[720px]' }

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  useEscapeKey(onClose)
  useFocusTrap(panelRef, open)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(26,35,48,0.45)]"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'relative z-10 w-full bg-surface rounded-xl shadow-lg border border-border',
          'flex flex-col max-h-[90vh]',
          modalWidth[size],
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 -mt-1 -mr-1 flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas hover:text-ink transition-colors duration-[120ms]"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-canvas/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Confirmation dialog ─────────────────────────────────────────────────────── */

export type ConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, loading = false,
}: ConfirmDialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  useEscapeKey(onClose)
  useFocusTrap(panelRef, open)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-[rgba(26,35,48,0.45)]" aria-hidden />
      <div ref={panelRef} className="relative z-10 w-full max-w-[440px] bg-surface rounded-xl shadow-lg border border-border">
        <div className="px-6 pt-5 pb-4">
          <h2 id="confirm-title" className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-2 text-sm text-ink-muted leading-[22px]">{description}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={loading}
            className="h-9 px-4 rounded-md border border-border bg-surface text-sm font-medium text-ink hover:bg-canvas transition-colors duration-[120ms] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm transition-colors duration-[120ms] disabled:opacity-50',
              destructive
                ? 'bg-danger hover:bg-danger/90'
                : 'bg-accent hover:bg-accent-hover',
            )}
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
