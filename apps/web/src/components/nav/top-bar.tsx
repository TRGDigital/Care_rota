'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, LogOut } from 'lucide-react'

type Props = {
  homeName: string
  userEmail: string
}

export function TopBar({ homeName, userEmail }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  function toggleChat() {
    window.dispatchEvent(new CustomEvent('toggle-chat'))
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-5 lg:px-6">
      {/* Left: home name breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold text-ink truncate">{homeName}</span>
      </div>

      {/* Right: chat + user */}
      <div className="flex items-center gap-1">
        {/* Chat toggle */}
        <button
          onClick={toggleChat}
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-canvas hover:text-ink transition-colors duration-[120ms]"
          title="AI Chat (⌘K)"
          aria-label="Toggle AI Chat"
        >
          <MessageSquare className="h-5 w-5" />
        </button>

        {/* Divider */}
        <div className="mx-2 h-5 w-px bg-border" aria-hidden />

        {/* User email */}
        <span className="hidden sm:block text-sm text-ink-muted mr-3 truncate max-w-[200px]">
          {userEmail}
        </span>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-muted hover:bg-canvas hover:text-ink transition-colors duration-[120ms]"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  )
}
