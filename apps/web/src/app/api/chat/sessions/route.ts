import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const BodySchema = z.object({
  homeId: z.string().uuid(),
  title:  z.string().max(200).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { homeId, title } = parsed.data

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      tenant_id:          homeId,
      home_id:            homeId,
      user_id:            user.id,
      title:              title ?? null,
      created_by_user_id: user.id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessionId: session.id })
}
