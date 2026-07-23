import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const OfflineEventSchema = z.object({
  clientId:         z.string(), // IndexedDB local ID — returned in response for deduplication
  kioskId:          z.string().uuid(),
  staffId:          z.string().uuid(),
  eventType:        z.enum(['clock_in', 'clock_out', 'disturbed_start', 'disturbed_end']),
  eventTimeUtc:     z.string().datetime(),
  captureMethod:    z.enum(['kiosk_pin', 'kiosk_nfc']),
  pinMatch:         z.boolean().nullable().optional(),
  nfcUid:           z.string().optional(),
  requiresReview:   z.boolean().optional(),
})

const BodySchema = z.object({
  events: z.array(OfflineEventSchema).min(1).max(500),
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

  const { events } = parsed.data
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Verify all kioskIds in the batch are active (deduplicate lookups)
  const kioskIds = [...new Set(events.map(e => e.kioskId))]
  const { data: kiosks, error: kioskErr } = await supabase
    .from('kiosks')
    .select('id, home_id, tenant_id, is_active')
    .in('id', kioskIds)

  if (kioskErr) {
    return NextResponse.json({ error: 'db_error', message: kioskErr.message }, { status: 500 })
  }

  const kioskMap = new Map(
    (kiosks ?? []).filter(k => k.is_active).map(k => [k.id, k])
  )

  const results: Array<{ clientId: string; clockingId?: string; error?: string }> = []

  for (const evt of events) {
    const kiosk = kioskMap.get(evt.kioskId)
    if (!kiosk) {
      results.push({ clientId: evt.clientId, error: 'kiosk_not_found' })
      continue
    }

    const { data: clocking, error: insertErr } = await supabase
      .from('shift_clockings')
      .insert({
        tenant_id:        kiosk.tenant_id,
        home_id:          kiosk.home_id,
        kiosk_id:         evt.kioskId,
        staff_id:         evt.staffId,
        event_type:       evt.eventType,
        event_time_utc:   evt.eventTimeUtc,
        capture_method:   evt.captureMethod,
        pin_match:        evt.pinMatch ?? null,
        nfc_uid:          evt.nfcUid ?? null,
        requires_review:  evt.requiresReview ?? false,
        offline_queued:   true,
        offline_synced_at: now,
      })
      .select('id')
      .single()

    if (insertErr || !clocking) {
      results.push({ clientId: evt.clientId, error: insertErr?.message ?? 'insert_failed' })
    } else {
      results.push({ clientId: evt.clientId, clockingId: clocking.id })
    }
  }

  const succeeded = results.filter(r => !r.error).length
  const failed    = results.filter(r =>  r.error).length

  return NextResponse.json({ succeeded, failed, results })
}
