import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Offline cache payload — downloaded by the kiosk when online.
// Includes PIN hashes so the kiosk can validate offline.
// Served without authentication; the kioskId UUID is the credential.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kioskId: string }> },
) {
  const { kioskId } = await params
  const supabase = createServiceClient()

  const { data: kiosk, error: kioskErr } = await supabase
    .from('kiosks')
    .select('id, home_id, tenant_id, is_active')
    .eq('id', kioskId)
    .single()

  if (kioskErr || !kiosk || !kiosk.is_active) {
    return NextResponse.json({ error: 'kiosk_not_found' }, { status: 404 })
  }

  const [staffRes, pinsRes, badgesRes] = await Promise.all([
    supabase
      .from('staff')
      .select('id, first_name, last_name, employee_number, photo_url')
      .eq('home_id', kiosk.home_id)
      .eq('status', 'active'),

    supabase
      .from('staff_kiosk_pins')
      .select('staff_id, pin_hash, pin_locked_at')
      .eq('home_id', kiosk.home_id),

    supabase
      .from('nfc_badges')
      .select('staff_id, nfc_uid')
      .eq('home_id', kiosk.home_id)
      .is('deactivated_at', null),
  ])

  if (staffRes.error || pinsRes.error || badgesRes.error) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  // Index credentials by staff_id for O(1) lookup in the offline worker
  const pinsByStaff = Object.fromEntries(
    (pinsRes.data ?? []).map(p => [
      p.staff_id,
      { hash: p.pin_hash, locked: !!p.pin_locked_at },
    ])
  )

  const nfcByStaff: Record<string, string[]> = {}
  for (const b of badgesRes.data ?? []) {
    ;(nfcByStaff[b.staff_id] ??= []).push(b.nfc_uid)
  }

  const staff = (staffRes.data ?? []).map(s => ({
    id:             s.id,
    firstName:      s.first_name,
    lastName:       s.last_name,
    employeeNumber: s.employee_number,
    photoUrl:       s.photo_url,
    pin:            pinsByStaff[s.id] ?? null,
    nfcUids:        nfcByStaff[s.id] ?? [],
  }))

  return NextResponse.json({
    homeId:    kiosk.home_id,
    fetchedAt: new Date().toISOString(),
    staff,
  })
}
