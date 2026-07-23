import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Anthropic from '@anthropic-ai/sdk'
import { chat } from '@carerota/domain/server'
import { z } from 'zod'

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

// Simple in-process rate limit: N questions per homeId per hour.
// In production this moves to Redis; for v1 this prevents accidental runaway loops.
const RATE_LIMIT = 100
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(homeId: string): { allowed: boolean; retryAfterSecs?: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(homeId)

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(homeId, { count: 1, resetAt: now + 3_600_000 })
    return { allowed: true }
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, retryAfterSecs: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true }
}

const BodySchema = z.object({
  homeId:    z.string().uuid(),
  sessionId: z.string().uuid(),
  question:  z.string().min(1).max(2000),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { homeId, sessionId, question } = parsed.data

  // Rate limit
  const rl = checkRateLimit(homeId)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `You've hit your hourly chat limit. Try again in ${Math.ceil((rl.retryAfterSecs ?? 3600) / 60)} minutes.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs ?? 3600) } },
    )
  }

  // Persist user message
  await supabase.from('chat_messages').insert({
    tenant_id:          homeId,
    home_id:            homeId,
    session_id:         sessionId,
    role:               'user',
    content:            question,
    created_by_user_id: user.id,
  })

  // Update session timestamp
  await supabase.from('chat_sessions')
    .update({ last_message_at: new Date().toISOString(), updated_by_user_id: user.id })
    .eq('id', sessionId)

  try {
    const response = await chat(question, {
      supabase,
      homeId,
      sessionId,
      userId: user.id,
      anthropic,
    })

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const homeId    = req.nextUrl.searchParams.get('homeId')
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!homeId || !sessionId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, role, content, citations_json, tools_used, created_at')
    .eq('home_id', homeId)
    .eq('session_id', sessionId)
    .order('created_at')

  return NextResponse.json({ messages: messages ?? [] })
}
