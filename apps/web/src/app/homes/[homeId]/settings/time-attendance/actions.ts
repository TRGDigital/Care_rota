'use server'

import { createClient } from '@/lib/supabase/server'

export async function saveGraceWindows(
  homeId: string,
  values: {
    noShowGraceMinutes: number
    noClockOutHoldMinutes: number
    clockInEarlyWindowMinutes: number
  },
): Promise<{ error?: string }> {
  if (
    !Number.isInteger(values.noShowGraceMinutes) ||
    !Number.isInteger(values.noClockOutHoldMinutes) ||
    !Number.isInteger(values.clockInEarlyWindowMinutes) ||
    values.noShowGraceMinutes < 0 || values.noShowGraceMinutes > 480 ||
    values.noClockOutHoldMinutes < 0 || values.noClockOutHoldMinutes > 480 ||
    values.clockInEarlyWindowMinutes < 0 || values.clockInEarlyWindowMinutes > 480
  ) {
    return { error: 'Values must be whole numbers between 0 and 480' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const { error } = await supabase
    .from('homes')
    .update({
      no_show_grace_minutes:        values.noShowGraceMinutes,
      no_clock_out_hold_minutes:    values.noClockOutHoldMinutes,
      clock_in_early_window_minutes: values.clockInEarlyWindowMinutes,
      updated_at: new Date().toISOString(),
      updated_by_user_id: user.id,
    })
    .eq('id', homeId)

  return error ? { error: error.message } : {}
}

export async function saveGeofence(
  homeId: string,
  tenantId: string,
  values: {
    centre_lat: number
    centre_lng: number
    radius_metres: number
    existingId: string | null
  },
): Promise<{ error?: string }> {
  if (
    isNaN(values.centre_lat) || isNaN(values.centre_lng) ||
    values.centre_lat < -90 || values.centre_lat > 90 ||
    values.centre_lng < -180 || values.centre_lng > 180 ||
    values.radius_metres < 10 || values.radius_metres > 5000
  ) {
    return { error: 'Invalid coordinates or radius (10–5000 m)' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const now = new Date().toISOString()

  if (values.existingId) {
    const { error } = await supabase
      .from('geofences')
      .update({
        centre_lat:    values.centre_lat,
        centre_lng:    values.centre_lng,
        radius_metres: values.radius_metres,
        updated_at:    now,
        updated_by_user_id: user.id,
      })
      .eq('id', values.existingId)
    return error ? { error: error.message } : {}
  }

  const { error } = await supabase
    .from('geofences')
    .insert({
      tenant_id:     tenantId,
      home_id:       homeId,
      centre_lat:    values.centre_lat,
      centre_lng:    values.centre_lng,
      radius_metres: values.radius_metres,
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
    })
  return error ? { error: error.message } : {}
}
