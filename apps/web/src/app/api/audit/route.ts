import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { tenantContextFromUser } from '@/lib/auth/context'
import { recordAudit } from '@carerota/domain/server'

const AuditRequestSchema = z.object({
  homeId:       z.string().uuid(),
  actionCode:   z.string().min(1),
  entityType:   z.string().min(1),
  entityId:     z.string().uuid(),
  beforeState:  z.unknown().optional(),
  afterState:   z.unknown().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = AuditRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const ctx = tenantContextFromUser(user)
  if (!ctx || ctx.homeId !== parsed.data.homeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await recordAudit(supabase, {
    homeId:       parsed.data.homeId,
    actorUserId:  user.id,
    actionCode:   parsed.data.actionCode,
    entityType:   parsed.data.entityType,
    entityId:     parsed.data.entityId,
    beforeState:  parsed.data.beforeState,
    afterState:   parsed.data.afterState,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
