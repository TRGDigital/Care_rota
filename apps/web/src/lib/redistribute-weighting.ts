import type { Database } from '@carerota/types/src/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Supabase = SupabaseClient<Database>

// The overtime weighting is a % SHARE of the overtime pool. The pool is every active,
// overtime-eligible staff member (across roles), and the shares always sum to 100%. Adjusting
// one person redistributes the remainder equally across the others, so e.g. 11 eligible staff
// sit at ~9.09% each by default.

async function getEligible(supabase: Supabase, homeId: string): Promise<string[]> {
  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('home_id', homeId)
    .eq('overtime_eligible', true)
    .eq('status', 'active')
  return (data ?? []).map(s => s.id)
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
  const eligible = await getEligible(supabase, homeId)
  const others = eligible.filter(id => id !== staffId)
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

// Reset the whole eligible pool to equal shares. Call after the pool membership changes
// (someone becomes eligible/ineligible, changes role, goes on long-term sick, etc.).
export async function resetToEqualShares(
  supabase: Supabase,
  homeId: string,
  userId: string,
): Promise<void> {
  const eligible = await getEligible(supabase, homeId)
  if (eligible.length === 0) return
  const equalShare = round4(100 / eligible.length)
  await supabase.from('staff')
    .update({ overtime_weighting: equalShare, updated_by_user_id: userId })
    .in('id', eligible)
    .eq('home_id', homeId)
}
