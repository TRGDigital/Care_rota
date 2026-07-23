'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Pencil } from 'lucide-react'
import Link from 'next/link'

export function StaffActionMenu({ href }: { href: string }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 })
  const ref    = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function openMenu() {
    if (!btnRef.current) return
    const rect       = btnRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const right      = window.innerWidth - rect.right
    if (spaceBelow < 60) {
      setPos({ bottom: window.innerHeight - rect.top + 4, right })
    } else {
      setPos({ top: rect.bottom + 4, right })
    }
    setOpen(v => !v)
  }

  return (
    <div ref={ref}>
      <button
        ref={btnRef}
        onClick={openMenu}
        className="flex items-center rounded p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
        title="Actions"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          className="fixed z-50 w-44 rounded-lg border bg-card py-1 shadow-lg"
          style={{
            top:    pos.top    !== undefined ? pos.top    : undefined,
            bottom: pos.bottom !== undefined ? pos.bottom : undefined,
            right:  pos.right,
          }}
        >
          <Link
            href={href}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-muted/30 transition-colors"
          >
            <Pencil size={14} className="text-muted-foreground" />
            Edit details
          </Link>
        </div>
      )}
    </div>
  )
}
