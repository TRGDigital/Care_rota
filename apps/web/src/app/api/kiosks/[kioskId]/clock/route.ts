import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const ClockEventSchema = z.object({
  staffId:          z.string().uuid(),
  eventType:        z.enum(['clock_in', 'clock_out', 'disturbed_start', 'disturbed_end']),
  eventTimeUtc:     z.string().datetime().optional(), // defaults to now
  captureMethod:    z.enum(['kiosk_pin', 'kiosk_nfc']),
  pin:              z.string().min(4).max(8).optional(),
  nfcUid:           z.string().optional(),
  photoBase64:      z.string().optional(), // store URL after upload; placeholder for Sprint 5
  gpsAccuracyMetres: z.number().optional(),
  lat:              z.number().optional(),
  lng:              z.number().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kioskId: string }> },
) {
  const { kioskId } = await params
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Verify kiosk exists and is active
  const { data: kiosk, error: kioskErr } = await supabase
    .from('kiosks')
    .select('id, home_id, tenant_id, is_active')
    .eq('id', kioskId)
    .single()

  if (kioskErr || !kiosk || !kiosk.is_active) {
    return NextResponse.json({ error: 'kiosk_not_found' }, { status: 404 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = ClockEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 422 })
  }

  const evt = parsed.data
  const eventTimeUtc = evt.eventTimeUtc ?? now

  // Verify staff belongs to this home
  const { data: staffRecord, error: staffErr } = await supabase
    .from('staff')
    .select('id')
    .eq('id', evt.staffId)
    .eq('home_id', kiosk.home_id)
    .single()

  if (staffErr || !staffRecord) {
    return NextResponse.json({ error: 'staff_not_found' }, { status: 404 })
  }

  let pinMatch: boolean | null = null
  let requiresReview = false

  if (evt.captureMethod === 'kiosk_pin') {
    if (!evt.pin) {
      return NextResponse.json({ error: 'pin_required' }, { status: 422 })
    }

    // Look up PIN record; check lock
    const { data: pinRecord } = await supabase
      .from('staff_kiosk_pins')
      .select('pin_hash, pin_locked_at, attempts')
      .eq('staff_id', evt.staffId)
      .eq('home_id', kiosk.home_id)
      .single()

    if (!pinRecord) {
      return NextResponse.json({ error: 'pin_not_set' }, { status: 422 })
    }

    if (pinRecord.pin_locked_at) {
      return NextResponse.json({ error: 'pin_locked' }, { status: 403 })
    }

    const submittedHash = createHash('sha256').update(evt.pin).digest('hex')
    pinMatch = submittedHash === pinRecord.pin_hash

    if (!pinMatch) {
      requiresReview = true
      // Increment attempts; lock after 5 failures
      const newAttempts = (pinRecord.attempts ?? 0) + 1
      await supabase
        .from('staff_kiosk_pins')
        .update({
          attempts: newAttempts,
          pin_locked_at: newAttempts >= 3 ? now : null,
          updated_at: now,
        })
        .eq('staff_id', evt.staffId)
        .eq('home_id', kiosk.home_id)
    } else {
      // Reset attempt counter on successful PIN
      await supabase
        .from('staff_kiosk_pins')
        .update({ attempts: 0, updated_at: now })
        .eq('staff_id', evt.staffId)
        .eq('home_id', kiosk.home_id)
    }
  }

  if (evt.captureMethod === 'kiosk_nfc') {
    if (!evt.nfcUid) {
      return NextResponse.json({ error: 'nfc_uid_required' }, { status: 422 })
    }

    const { data: badge } = await supabase
      .from('nfc_badges')
      .select('id')
      .eq('staff_id', evt.staffId)
      .eq('home_id', kiosk.home_id)
      .eq('nfc_uid', evt.nfcUid)
      .is('deactivated_at', null)
      .single()

    if (!badge) {
      requiresReview = true
    }
  }

  // Write the clocking event
  const photoExpiresAt = evt.photoBase64
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    : null

  const { data: clocking, error: insertErr } = await supabase
    .from('shift_clockings')
    .insert({
      tenant_id:           kiosk.tenant_id,
      home_id:             kiosk.home_id,
      kiosk_id:            kioskId,
      staff_id:            evt.staffId,
      event_type:          evt.eventType,
      event_time_utc:      eventTimeUtc,
      capture_method:      evt.captureMethod,
      pin_match:           pinMatch,
      nfc_uid:             evt.nfcUid ?? null,
      gps_accuracy_metres: evt.gpsAccuracyMetres ?? null,
      lat:                 evt.lat ?? null,
      lng:                 evt.lng ?? null,
      requires_review:     requiresReview,
      photo_expires_at:    photoExpiresAt,
      offline_queued:      false,
    })
    .select('id')
    .single()

  if (insertErr || !clocking) {
    return NextResponse.json({ error: 'db_error', message: insertErr?.message }, { status: 500 })
  }

  // Update kiosk last_seen_at
  await supabase
    .from('kiosks')
    .update({ last_seen_at: now, updated_at: now })
    .eq('id', kioskId)

  return NextResponse.json({
    clockingId:     clocking.id,
    pinMatch,
    requiresReview,
    eventTimeUtc,
  })
}
