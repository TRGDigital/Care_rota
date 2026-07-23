'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteStaff } from './directory-edit-actions'

export function StaffActionMenu({ href, homeId, staffId, staffName }: {
  href: string
  homeId: string
  staffId: string
  staffName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pos,  setPos]  = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 })
  const ref    = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirming(false); setErr(null) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function openMenu() {
    if (!btnRef.current) return
    const rect       = btnRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const right      = window.innerWidth - rect.right
    if (spaceBelow < 120) setPos({ bottom: window.innerHeight - rect.top + 4, right })
    else setPos({ top: rect.bottom + 4, right })
    setOpen(v => !v); setConfirming(false); setErr(null)
  }

  async function onDelete() {
    setBusy(true); setErr(null)
    const r = await deleteStaff(homeId, staffId)
    setBusy(false)
    if (r.error) { setErr(r.error); setConfirming(false) }
    else { setOpen(false); router.refresh() }
  }

  return (
    <div ref={ref}>
      <button ref={btnRef} onClick={openMenu}
        className="flex items-center rounded p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors" title="Actions">
        <MoreVertical size={15} />
      </button>

      {open && (
        <div className="fixed z-50 w-56 rounded-lg border bg-card py-1 shadow-lg"
          style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}>
          <Link href={href} onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-muted/30 transition-colors">
            <Pencil size={14} className="text-muted-foreground" />
            Edit details
          </Link>

          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
              Delete
            </button>
          ) : (
            <div className="px-4 py-2 text-xs">
              <p className="mb-2 text-foreground">Delete <strong>{staffName}</strong>? This can&rsquo;t be undone.</p>
              <div className="flex gap-2">
                <button onClick={onDelete} disabled={busy}
                  className="rounded bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
                <button onClick={() => setConfirming(false)} className="rounded border px-2.5 py-1 text-muted-foreground">Cancel</button>
              </div>
            </div>
          )}
          {err && <p className="px-4 py-2 text-xs text-red-600">{err}</p>}
        </div>
      )}
    </div>
  )
}
