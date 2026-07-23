import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const BodySchema = z.object({
  token:     z.string().min(32).max(256),
  kioskName: z.string().min(1).max(100).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { token, kioskName } = parsed.data
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Look up the pairing token
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('kiosk_pairing_tokens')
    .select('id, tenant_id, home_id, kiosk_id, kiosk_name, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .single()

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: 'token_not_found' }, { status: 404 })
  }

  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'token_already_used' }, { status: 409 })
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'token_expired' }, { status: 410 })
  }

  const resolvedName = kioskName ?? tokenRow.kiosk_name

  let kioskId = tokenRow.kiosk_id

  if (kioskId) {
    // Re-pair an existing kiosk (e.g. iPad replaced)
    const { error: updateErr } = await supabase
      .from('kiosks')
      .update({ paired_at: now, is_active: true, name: resolvedName, updated_at: now })
      .eq('id', kioskId)

    if (updateErr) {
      return NextResponse.json({ error: 'db_error', message: updateErr.message }, { status: 500 })
    }
  } else {
    // First pairing — create the kiosk row
    const { data: newKiosk, error: insertErr } = await supabase
      .from('kiosks')
      .insert({
        tenant_id: tokenRow.tenant_id,
        home_id:   tokenRow.home_id,
        name:      resolvedName,
        paired_at: now,
        is_active: true,
      })
      .select('id')
      .single()

    if (insertErr || !newKiosk) {
      return NextResponse.json({ error: 'db_error', message: insertErr?.message }, { status: 500 })
    }
    kioskId = newKiosk.id
  }

  // Mark the token as used
  await supabase
    .from('kiosk_pairing_tokens')
    .update({ used_at: now, kiosk_id: kioskId })
    .eq('id', tokenRow.id)

  return NextResponse.json({
    kioskId,
    homeId:   tokenRow.home_id,
    tenantId: tokenRow.tenant_id,
    name:     resolvedName,
  })
}
