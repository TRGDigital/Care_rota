import type { Database } from '@carerota/types/src/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Supabase = SupabaseClient<Database>

async function getStaffRole(supabase: Supabase, homeId: string, staffId: string): Promise<string | null> {
  const { data } = await supabase
    .from('staff_pay_rates')
    .select('role_code')
    .eq('staff_id', staffId)
    .eq('home_id', homeId)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.role_code ?? null
}

async function getEligibleInRole(supabase: Supabase, homeId: string, role: string | null): Promise<string[]> {
  const { data: eligible } = await supabase
    .from('staff')
    .select('id')
    .eq('home_id', homeId)
    .eq('overtime_eligible', true)
    .eq('status', 'active')

  const ids = (eligible ?? []).map(s => s.id)
  if (ids.length === 0) return []

  const { data: rates } = await supabase
    .from('staff_pay_rates')
    .select('staff_id, role_code')
    .eq('home_id', homeId)
    .in('staff_id', ids)
    .order('effective_from', { ascending: false })

  const latestRole = new Map<string, string | null>()
  for (const r of rates ?? []) {
    if (!latestRole.has(r.staff_id)) latestRole.set(r.staff_id, r.role_code)
  }
  for (const id of ids) {
    if (!latestRole.has(id)) latestRole.set(id, null)
  }

  return ids.filter(id => latestRole.get(id) === role)
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export async function setWeightingWithRedistribution(
  supabase: Supabase,
  homeId: string,
  staffId: string,
  newWeight: number,
  userId: string,
): Promise<void> {
  const role = await getStaffRole(supabase, homeId, staffId)
  const inRole = await getEligibleInRole(supabase, homeId, role)
  const others = inRole.filter(id => id !== staffId)

  const otherWeight = others.length > 0 ? round4((100 - newWeight) / others.length) : 0

  await supabase.from('staff')
    .update({ overtime_weighting: newWeight, updated_by_user_id: userId })
    .eq('id', staffId)
    .eq('home_id', homeId)

  if (others.length > 0) {
    await supabase.from('staff')
      .update({ overtime_weighting: otherWeight, updated_by_user_id: userId })
      .in('id', others)
      .eq('home_id', homeId)
  }
}

export async function resetRoleToEqualShares(
  supabase: Supabase,
  homeId: string,
  staffId: string,
  userId: string,
): Promise<void> {
  const role = await getStaffRole(supabase, homeId, staffId)
  const inRole = await getEligibleInRole(supabase, homeId, role)
  if (inRole.length === 0) return

  const equalShare = round4(100 / inRole.length)

  await supabase.from('staff')
    .update({ overtime_weighting: equalShare, updated_by_user_id: userId })
    .in('id', inRole)
    .eq('home_id', homeId)
}
