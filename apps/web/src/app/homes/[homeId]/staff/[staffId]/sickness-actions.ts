'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { raiseRebalanceSuggestion } from '@carerota/domain/server'

export async function reportSickness(homeId: string, staffId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const today = new Date().toISOString().split('T')[0]!

  // Prevent duplicate open episode
  const { data: existing } = await supabase
    .from('sickness_episodes')
    .select('id')
    .eq('staff_id', staffId)
    .eq('home_id', homeId)
    .is('last_day_of_sickness', null)
    .limit(1)
    .maybeSingle()

  if (existing) return { error: 'An open sickness episode already exists for this staff member.' }

  const { data: episode, error } = await supabase
    .from('sickness_episodes')
    .insert({
      home_id: homeId,
      tenant_id: homeId,
      staff_id: staffId,
      first_day_of_sickness: today,
      covering_strategy: 'rebalance',
      ssp_eligible: false,
      contractual_pay_applied: false,
      created_by_user_id: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Release assigned shifts in the next 48 hours
  const next48h = new Date(Date.now() + 48 * 3_600_000).toISOString()
  const { data: nearShifts } = await supabase
    .from('shifts')
    .select('id, planned_start_utc')
    .eq('home_id', homeId)
    .eq('staff_id', staffId)
    .eq('state', 'assigned')
    .lte('planned_start_utc', next48h)
    .gte('planned_start_utc', new Date().toISOString())

  const affectedDates: string[] = []
  if (nearShifts?.length) {
    for (const sh of nearShifts) {
      await supabase.from('shifts').update({
        staff_id: null,
        state: 'unassigned',
        updated_by_user_id: user.id,
      }).eq('id', sh.id)

      const d = sh.planned_start_utc.split('T')[0]!
      if (!affectedDates.includes(d)) affectedDates.push(d)
    }

    // Raise rebalance suggestion for the released shifts
    await raiseRebalanceSuggestion(
      supabase as never,
      homeId,
      'sickness_reported',
      episode.id,
      staffId,
      affectedDates,
      user.id
    )
  }

  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true, shiftsReleased: nearShifts?.length ?? 0 }
}

export async function closeReturnToWork(homeId: string, staffId: string, episodeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const today = new Date().toISOString().split('T')[0]!

  // Get episode for SSP qualifying days
  const { data: episode } = await supabase
    .from('sickness_episodes')
    .select('first_day_of_sickness')
    .eq('id', episodeId)
    .eq('home_id', homeId)
    .single()

  if (!episode) return { error: 'Episode not found' }

  const firstDay = new Date(episode.first_day_of_sickness)
  const lastDay = new Date(today)
  const calendarDays = Math.round((lastDay.getTime() - firstDay.getTime()) / 86_400_000) + 1
  // SSP qualifying days: calendar days excluding the 3-day waiting period
  const qualifyingDays = Math.max(0, calendarDays - 3)
  const sspEligible = qualifyingDays > 0

  const { error } = await supabase
    .from('sickness_episodes')
    .update({
      last_day_of_sickness: today,
      qualifying_days: qualifyingDays,
      ssp_eligible: sspEligible,
      return_to_work_completed_at: new Date().toISOString(),
      updated_by_user_id: user.id,
    })
    .eq('id', episodeId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }

  revalidatePath(`/homes/${homeId}/staff/${staffId}`)
  return { success: true, qualifyingDays, sspEligible }
}
