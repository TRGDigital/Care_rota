'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { ChatMessage } from './chat-message'
import type { Citation } from '@carerota/domain'

type Message = {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  citations: Citation[]
}

type Props = {
  homeId: string
}

const SUGGESTED = [
  "How much did we spend on overtime last month?",
  "Show me staff with training expiring in 30 days",
  "What did the manager override last week?",
  "Compare payroll cost to last quarter",
]

export function ChatPanel({ homeId }: Props) {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError]         = useState<string | null>(null)
  const bottomRef                  = useRef<HTMLDivElement>(null)
  const inputRef                   = useRef<HTMLTextAreaElement>(null)

  // Cmd/Ctrl+K + custom toggle-chat event
  useEffect(() => {
    function keyHandler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
    }
    function eventHandler() { setOpen(v => !v) }
    window.addEventListener('keydown', keyHandler)
    window.addEventListener('toggle-chat', eventHandler)
    return () => {
      window.removeEventListener('keydown', keyHandler)
      window.removeEventListener('toggle-chat', eventHandler)
    }
  }, [])

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId
    const res = await fetch('/api/chat/sessions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ homeId }),
    })
    const { sessionId: id } = await res.json() as { sessionId: string }
    setSessionId(id)
    return id
  }, [homeId, sessionId])

  async function sendMessage(text: string) {
    if (!text.trim() || pending) return
    setError(null)
    setInput('')

    const userMsg: Message = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   text.trim(),
      citations: [],
    }
    setMessages(prev => [...prev, userMsg])

    startTransition(async () => {
      try {
        const sid = await ensureSession()
        const res = await fetch('/api/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ homeId, sessionId: sid, question: text.trim() }),
        })

        if (res.status === 429) {
          const { error: msg } = await res.json() as { error: string }
          setError(msg)
          return
        }

        if (!res.ok) throw new Error(await res.text())

        const data = await res.json() as { content: string; citations?: Citation[] }
        setMessages(prev => [...prev, {
          id:        crypto.randomUUID(),
          role:      'assistant',
          content:   data.content,
          citations: data.citations ?? [],
        }])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open chat assistant (Cmd+K)"
        title="Chat assistant (⌘K)"
      >
        <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    )
  }

  return (
    <div
      className="fixed bottom-0 right-0 z-40 flex h-full max-h-[600px] w-full max-w-md flex-col border-l border-t rounded-tl-xl bg-background shadow-2xl"
      role="complementary"
      aria-label="CareRota chat assistant"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">CareRota Assistant</p>
          <p className="text-xs text-muted-foreground">Ask about rotas, payroll, compliance</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close chat panel"
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">Suggested questions:</p>
            {SUGGESTED.map(q => (
              <button
                key={q}
                onClick={() => void sendMessage(q)}
                className="w-full text-left rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} citations={msg.citations} />
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground animate-pulse">
              Thinking…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send)"
            aria-label="Chat message input"
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-32"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
            disabled={pending}
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={pending || !input.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground text-right">⌘K to toggle · Shift+Enter for newline</p>
      </div>
    </div>
  )
}
